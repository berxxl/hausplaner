/**
 * Geometrie der Geräte (design.md M2 „Geräte platzieren“, „Bezug und Bemaßung“,
 * „Höhenbezug bei geänderter Raumzuordnung“). Frei von React.
 */
import { rawCeilingAt, roomHeights, isSlopeValid, slopeHeight } from "./ceiling";
import { fromPath, offset, toPath } from "./clipper";
import { pointInPolygon } from "./polygon";
import {
  sections,
  sidePoint,
  sideU,
  slopeFrame,
  wallSides,
  type Section,
  type WallSide,
} from "./surfaces";
import { add, dot, scale, sub, type Vec } from "./vec";
import { surfaceKind } from "../model/devices";
import type {
  Device,
  DevicePlacement,
  DeviceType,
  Mounting,
  Project,
  Room,
  Storey,
} from "../model/types";

/** Abstand vor der fertigen Wandoberfläche, bis zu dem ein Klick im Grundriss die Wandseite trifft. */
export const WALL_PICK_DISTANCE_MM = 300;
/** Höhe von Wandgeräten ohne Standardhöhe beim Setzen im Grundriss. */
export const FALLBACK_WALL_HEIGHT_MM = 1000;

const MOUNTING_NAMES: Record<Mounting, string> = {
  wall: "Wand",
  ceiling: "Decke",
  floor: "Boden",
  "din-rail": "Hutschiene",
  free: "frei",
};

/** „<Typ> ist nur für Wand, Boden zulässig“ */
export function mountingMessage(type: DeviceType): string {
  return `${type.name} ist nur für ${type.mounting.map((m) => MOUNTING_NAMES[m]).join(", ")} zulässig`;
}

const floorBuildup = (room: Room, storey: Storey) =>
  room.floorBuildupMm ?? storey.defaults.floorBuildupMm;
const plaster = (room: Room, storey: Storey) => room.plasterMm ?? storey.defaults.plasterMm;

/** Geschoss einer Fläche ("wall:<id>:L", "ceiling:<roomId>" …) oder undefined. */
export function surfaceStoreyId(project: Project, surface: string): string | undefined {
  const id = surface.split(":")[1];
  if (surfaceKind(surface) === "wall") return project.walls.find((w) => w.id === id)?.storeyId;
  return project.rooms.find((r) => r.id === id)?.storeyId;
}

/** Raumabschnitt einer Wandseite an der Stelle u (ohne Raum: undefined). */
export function sectionAt(secs: readonly Section[], ref: string, u: number): Section | undefined {
  return secs.find((s) => s.ref === ref && u >= s.uFrom && u <= s.uTo);
}

/** Raum, auf den sich v eines Wandgeräts bezieht; null ohne Raum. */
export function wallDeviceRoom(
  project: Project,
  device: Device,
  secs?: readonly Section[],
): Room | null {
  if (device.placement.kind !== "surface") return null;
  const ref = device.placement.surface;
  if (surfaceKind(ref) !== "wall") return null;
  const s = sectionAt(secs ?? sections(project, device.storeyId), ref, device.placement.u);
  return s ? (project.rooms.find((r) => r.id === s.roomId) ?? null) : null;
}

/** Fußbodenaufbau, auf den sich die Höhe eines Wandgeräts bezieht (ohne Raum 0). */
export function wallDeviceBuildup(project: Project, device: Device, secs?: readonly Section[]) {
  const room = wallDeviceRoom(project, device, secs);
  const storey = project.storeys.find((s) => s.id === device.storeyId);
  return room && storey ? floorBuildup(room, storey) : 0;
}

/** Rohbauhöhe eines Wandgeräts: v + Fußbodenaufbau. */
export function rawHeightOf(project: Project, device: Device): number | null {
  if (device.placement.kind !== "surface" || surfaceKind(device.placement.surface) !== "wall")
    return null;
  return device.placement.v + wallDeviceBuildup(project, device);
}

/**
 * Korrekturen von v für Wandgeräte, deren Raumzuordnung sich zwischen `before` und `after` geändert
 * hat, sodass die Rohbauhöhe gleich bleibt. Ändert sich nur der Fußbodenaufbau desselben Raums,
 * bleibt v (keine Korrektur).
 */
export function deviceHeightAdjustments(
  before: Project,
  after: Project,
): { id: string; delta: number }[] {
  const adjustments: { id: string; delta: number }[] = [];
  const isWall = (d: Device) =>
    d.placement.kind === "surface" && surfaceKind(d.placement.surface) === "wall";
  const storeys = new Set(after.devices.filter(isWall).map((d) => d.storeyId));
  for (const storeyId of storeys) {
    const secsBefore = sections(before, storeyId);
    const secsAfter = sections(after, storeyId);
    for (const device of after.devices) {
      if (device.storeyId !== storeyId || !isWall(device)) continue;
      const old = before.devices.find((d) => d.id === device.id);
      if (!old || !isWall(old)) continue;
      // Vom Befehl selbst verschobene Geräte behalten ihre Werte
      if (JSON.stringify(old.placement) !== JSON.stringify(device.placement)) continue;
      const roomBefore = wallDeviceRoom(before, old, secsBefore);
      const roomAfter = wallDeviceRoom(after, device, secsAfter);
      if ((roomBefore?.id ?? null) === (roomAfter?.id ?? null)) continue;
      const delta =
        wallDeviceBuildup(before, old, secsBefore) - wallDeviceBuildup(after, device, secsAfter);
      if (delta !== 0) adjustments.push({ id: device.id, delta });
    }
  }
  return adjustments;
}

/** Weltlage eines Geräts: Mittelpunkt auf der fertigen Oberfläche, z über Rohfußboden des Geschosses. */
export interface DeviceWorld {
  x: number;
  y: number;
  z: number;
  /** Richtung von der Oberfläche in den Raum (Tiefe der 3D-Form) */
  normal: { x: number; y: number; z: number };
}

export function deviceWorld(project: Project, device: Device): DeviceWorld | null {
  return placementWorld(project, device.storeyId, device.placement);
}

/** Weltposition (z über Rohfußboden des Geschosses) einer Platzierung; auch für Trassenanker. */
export function placementWorld(
  project: Project,
  storeyId: string,
  p: DevicePlacement,
): DeviceWorld | null {
  const device = { storeyId, placement: p } as Device;
  if (p.kind === "free") return { x: p.x, y: p.y, z: p.z, normal: { x: 0, y: 0, z: 1 } };
  const storey = project.storeys.find((s) => s.id === storeyId);
  if (!storey) return null;
  const [kind, id, extra] = p.surface.split(":");
  if (kind === "wall") {
    const side = wallSides(project, storeyId).find((s) => s.ref === p.surface);
    if (!side) return null;
    const room = wallDeviceRoom(project, device);
    const pl = room ? plaster(room, storey) : 0;
    const q = add(sidePoint(side, p.u), scale(side.outward, pl));
    return {
      ...q,
      z: p.v + (room ? floorBuildup(room, storey) : 0),
      normal: { x: side.outward.x + 0, y: side.outward.y + 0, z: 0 },
    };
  }
  const room = project.rooms.find((r) => r.id === id);
  if (!room) return null;
  if (kind === "floor")
    return { x: p.u, y: p.v, z: floorBuildup(room, storey), normal: { x: 0, y: 0, z: 1 } };
  if (kind === "ceiling") {
    const q = { x: -p.u, y: p.v };
    return {
      ...q,
      z: rawCeilingAt(room, storey, q) - plaster(room, storey),
      normal: { x: 0, y: 0, z: -1 },
    };
  }
  const slope = room.slopes?.find((s) => s.id === extra);
  if (!slope || !isSlopeValid(slope, room.polygon)) return null;
  const frame = slopeFrame(room, slope);
  const q = frame.toPlan(p.u, p.v);
  const t = Math.tan((slope.angleDeg * Math.PI) / 180);
  // Normale der Schräge zur Raumseite: nach unten und zum Raum
  const len = Math.hypot(t, 1);
  return {
    ...q,
    z: slopeHeight(slope, room.polygon, q) - plaster(room, storey),
    normal: { x: (frame.m.x * t) / len, y: (frame.m.y * t) / len, z: -1 / len },
  };
}

/** Frontrechteck in Flächenkoordinaten (Mitte u, v; Maße aus shape3d). */
export function frontRect(device: Device, type: DeviceType | undefined) {
  const w = type?.shape3d.widthMm ?? 80;
  const h = type?.shape3d.heightMm ?? 80;
  if (device.placement.kind !== "surface") return null;
  const { u, v } = device.placement;
  return { uMin: u - w / 2, uMax: u + w / 2, vMin: v - h / 2, vMax: v + h / 2 };
}

export type PlacementResult =
  { ok: true; placement: DevicePlacement } | { ok: false; error: string };

/** Wandseite, die ein Klick im Grundriss trifft: auf der Seite des Klicks, bis 300 mm vor der fertigen Oberfläche. */
export function pickWallSide(
  project: Project,
  storeyId: string,
  p: Vec,
): { side: WallSide; u: number } | null {
  const storey = project.storeys.find((s) => s.id === storeyId);
  const secs = sections(project, storeyId);
  let best: { side: WallSide; u: number; d: number } | null = null;
  for (const side of wallSides(project, storeyId)) {
    const wall = project.walls.find((w) => w.id === side.wallId)!;
    const u = sideU(side, p);
    if (u < side.uMin || u > side.uMax) continue;
    const d = dot(sub(p, side.origin), side.outward); // > 0 vor der rohen Seitenfläche
    const sec = sectionAt(secs, side.ref, u);
    const room = sec && project.rooms.find((r) => r.id === sec.roomId);
    const pl = room && storey ? plaster(room, storey) : 0;
    if (d < -wall.thicknessMm / 2 || d > pl + WALL_PICK_DISTANCE_MM) continue;
    if (!best || Math.abs(d) < Math.abs(best.d)) best = { side, u, d };
  }
  return best && { side: best.side, u: best.u };
}

/**
 * Platzierung eines Typs per Klick im Grundriss (design.md M2 „Geräte platzieren“):
 * Wandseite → Decke/Schräge → Boden → frei.
 */
export function planPlacement(
  project: Project,
  storeyId: string,
  type: DeviceType,
  p: Vec,
): PlacementResult {
  const allows = (m: Mounting) => type.mounting.includes(m);
  if (allows("wall")) {
    const hit = pickWallSide(project, storeyId, p);
    if (hit)
      return {
        ok: true,
        placement: {
          kind: "surface",
          surface: hit.side.ref,
          u: Math.round(hit.u),
          v: type.defaultHeightMm ?? FALLBACK_WALL_HEIGHT_MM,
          rotationDeg: 0,
        },
      };
  }
  const storey = project.storeys.find((s) => s.id === storeyId);
  const room = project.rooms.find(
    (r) => r.storeyId === storeyId && r.polygon.length >= 3 && pointInPolygon(p, r.polygon),
  );
  if (room && storey && allows("ceiling")) {
    const top = upperSurfaceAt(room, storey, p);
    return { ok: true, placement: { kind: "surface", ...top, rotationDeg: 0 } };
  }
  if (room && allows("floor"))
    return {
      ok: true,
      placement: {
        kind: "surface",
        surface: `floor:${room.id}`,
        u: Math.round(p.x),
        v: Math.round(p.y),
        rotationDeg: 0,
      },
    };
  if (allows("free"))
    return { ok: true, placement: { kind: "free", x: Math.round(p.x), y: Math.round(p.y), z: 0 } };
  return { ok: false, error: mountingMessage(type) };
}

/**
 * Fläche über einem Grundrisspunkt im Raum: die Schräge, die dort am tiefsten liegt, sonst die
 * Decke; mit gerundeten Flächenkoordinaten.
 */
export function upperSurfaceAt(
  room: Room,
  storey: Storey,
  p: Vec,
): { surface: string; u: number; v: number } {
  const h = roomHeights(room, storey);
  const flat = h.rawHeightMm - h.suspendedMm;
  let lowest: { id: string; h: number } | null = null;
  for (const s of room.slopes ?? []) {
    if (!isSlopeValid(s, room.polygon)) continue;
    const hs = slopeHeight(s, room.polygon, p);
    if (hs < flat && (!lowest || hs < lowest.h)) lowest = { id: s.id, h: hs };
  }
  if (lowest) {
    const slope = room.slopes!.find((s) => s.id === lowest.id)!;
    const uv = slopeFrame(room, slope).toUV(p);
    return {
      surface: `slope:${room.id}:${slope.id}`,
      u: Math.round(uv.u),
      v: Math.round(uv.v),
    };
  }
  return { surface: `ceiling:${room.id}`, u: Math.round(-p.x) || 0, v: Math.round(p.y) };
}

/** Platzierung per Klick in einer Flächenansicht. `kind` ist die Art der Fläche der Ansicht. */
export function viewPlacement(
  type: DeviceType,
  surface: string,
  u: number,
  v: number,
): PlacementResult {
  const kind = surfaceKind(surface);
  const needed: Mounting = kind === "slope" ? "ceiling" : kind;
  if (!type.mounting.includes(needed)) return { ok: false, error: mountingMessage(type) };
  return {
    ok: true,
    placement: {
      kind: "surface",
      surface,
      u: Math.round(u),
      v: kind === "wall" ? (type.defaultHeightMm ?? Math.round(v)) : Math.round(v),
      rotationDeg: 0,
    },
  };
}

/** Kantenlänge eines Gerätesymbols im Grundriss (design.md M2 „Darstellung“). */
export const PLAN_SYMBOL_MM = 250;

export type PlanFrame = "wall" | "ceiling" | "floor" | "free";

/** Mittelpunkt des Grundrisssymbols und Rahmenart; Wandgeräte nach innen vor die Oberfläche versetzt. */
export function planSymbol(
  project: Project,
  device: Device,
): { x: number; y: number; frame: PlanFrame } | null {
  const w = deviceWorld(project, device);
  if (!w) return null;
  if (device.placement.kind === "free") return { x: w.x, y: w.y, frame: "free" };
  const kind = surfaceKind(device.placement.surface);
  if (kind === "wall")
    return {
      x: w.x + (w.normal.x * PLAN_SYMBOL_MM) / 2,
      y: w.y + (w.normal.y * PLAN_SYMBOL_MM) / 2,
      frame: "wall",
    };
  return { x: w.x, y: w.y, frame: kind === "floor" ? "floor" : "ceiling" };
}

/** Richtungen im Grundriss: links −x, rechts +x, oben +y, unten −y. */
export type PlanDirection = "left" | "right" | "up" | "down";

const PLAN_RAYS: Record<PlanDirection, Vec> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
};

/**
 * Abstände eines Punkts zur fertigen Wandoberfläche des Raums in den vier Grundrissrichtungen
 * (Rohbaukontur um den Putz nach innen versetzt). null: kein Treffer in dieser Richtung.
 */
export function finishedWallDistances(
  polygon: readonly Vec[],
  plasterMm: number,
  q: Vec,
): Record<PlanDirection, number | null> {
  const contours =
    plasterMm > 0 ? offset([toPath(polygon)], -plasterMm).map(fromPath) : [[...polygon]];
  const result = { left: null, right: null, up: null, down: null } as Record<
    PlanDirection,
    number | null
  >;
  for (const [dir, r] of Object.entries(PLAN_RAYS) as [PlanDirection, Vec][]) {
    for (const c of contours)
      for (let i = 0; i < c.length; i++) {
        const a = c[i]!;
        const b = c[(i + 1) % c.length]!;
        const t = rayHit(q, r, a, b);
        if (t !== null && (result[dir] === null || t < result[dir]!)) result[dir] = t;
      }
  }
  return result;
}

/** Abstand entlang des Strahls q + t·r bis zur Strecke a–b, oder null. */
function rayHit(q: Vec, r: Vec, a: Vec, b: Vec): number | null {
  const s = sub(b, a);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const qa = sub(a, q);
  const t = (qa.x * s.y - qa.y * s.x) / den;
  const w = (qa.x * r.y - qa.y * r.x) / den;
  return t >= 0 && w >= 0 && w <= 1 ? t : null;
}
