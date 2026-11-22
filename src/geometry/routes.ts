/**
 * Geometrie der Trassen (design.md M3 „Knoten und Anker“, „Übergänge an Kanten“, „Durchbrüche“,
 * „Trassen zeichnen“). Frei von React.
 */
import { roomHeights } from "./ceiling";
import { placementWorld, surfaceStoreyId, upperSurfaceAt } from "./devices";
import { pointInPolygon } from "./polygon";
import {
  deriveRoomViews,
  sidePoint,
  sideU,
  wallSides,
  type RoomView,
  type WallSide,
} from "./surfaces";
import { add, dot, normalize, projectOnSegment, scale, sub, type Vec } from "./vec";
import { BOUNDARY_HALF_MM } from "./rooms";
import { topAt } from "./zones";
import { surfaceKind } from "../model/devices";
import type { Anchor, Cable, Project, RouteNode, RouteSegment } from "../model/types";

/** Toleranz für „liegt auf der Kante“ in mm. */
export const EDGE_TOLERANCE_MM = 1;

export interface World3 {
  x: number;
  y: number;
  /** über Rohfußboden des Geschosses */
  z: number;
  storeyId: string;
}

// --- Abgeleitete Hilfsdaten, je Projektstand zwischengespeichert ---

interface Derived {
  views: RoomView[];
  sides: Map<string, WallSide>;
}
const cache = new WeakMap<Project, Derived>();

function derived(project: Project): Derived {
  let d = cache.get(project);
  if (!d) {
    const views = [...deriveRoomViews(project).values()].flat();
    const sides = new Map<string, WallSide>();
    for (const s of project.storeys)
      for (const side of wallSides(project, s.id)) sides.set(side.ref, side);
    d = { views, sides };
    cache.set(project, d);
  }
  return d;
}

/** Raumansicht einer Wandseite, in deren fertigem u-Bereich u liegt (mit Toleranz). */
export function roomViewAt(project: Project, ref: string, u: number): RoomView | undefined {
  const t = EDGE_TOLERANCE_MM;
  return derived(project).views.find(
    (v) => v.ref === ref && u >= v.finished.uFrom - t && u <= v.finished.uTo + t,
  );
}

const anchorKey = (a: Anchor) => `${a.surface}|${a.u}|${a.v}`;
const roundAnchor = (surface: string, u: number, v: number): Anchor => ({
  surface,
  u: Math.round(u) || 0,
  v: Math.round(v) || 0,
});

// --- Anker → Welt ---

export function anchorWorld(project: Project, anchor: Anchor): World3 | null {
  const storeyId = surfaceStoreyId(project, anchor.surface);
  if (!storeyId) return null;
  const w = placementWorld(project, storeyId, {
    kind: "surface",
    surface: anchor.surface,
    u: anchor.u,
    v: anchor.v,
    rotationDeg: 0,
  });
  return w ? { x: w.x, y: w.y, z: w.z, storeyId } : null;
}

/** Höhe über Geländenull: Geschosshöhe + z. */
export function globalZ(project: Project, w: World3): number {
  return (project.storeys.find((s) => s.id === w.storeyId)?.elevationMm ?? 0) + w.z;
}

export function anchorOn(node: RouteNode, surface: string): Anchor | undefined {
  return node.anchors.find((a) => a.surface === surface);
}

/** Länge eines Flächensegments in (u, v) seiner Fläche; null, wenn ein Anker fehlt. */
export function surfaceSegmentLength(a: RouteNode, b: RouteNode, surface: string): number | null {
  const pa = anchorOn(a, surface);
  const pb = anchorOn(b, surface);
  if (!pa || !pb) return null;
  return Math.hypot(pb.u - pa.u, pb.v - pa.v);
}

/** Länge eines Segments (Fläche oder Durchbruch) in mm; null bei fehlenden Knoten oder Ankern. */
export function segmentLength(
  project: Project,
  segment: RouteSegment,
  nodes: ReadonlyMap<string, RouteNode>,
): number | null {
  const a = nodes.get(segment.a);
  const b = nodes.get(segment.b);
  if (!a || !b) return null;
  if (segment.kind === "surface")
    return segment.surface ? surfaceSegmentLength(a, b, segment.surface) : null;
  return penetrationLength(project, a.anchors[0]!, b.anchors[0]!);
}

// --- Übergänge an Kanten ---

/** Grundrisspunkt der fertigen Wandoberfläche einer Raumansicht bei u. */
function finishedPoint(project: Project, view: RoomView, u: number): Vec | null {
  const side = derived(project).sides.get(view.ref);
  return side ? add(sidePoint(side, u), scale(side.outward, view.plasterMm)) : null;
}

/** Anker auf Decke/Schräge bzw. Boden des Raums einer Raumansicht über/unter dem Wandpunkt u. */
function horizontalAnchor(
  project: Project,
  view: RoomView,
  u: number,
  which: "top" | "floor",
): Anchor | null {
  const p = finishedPoint(project, view, u);
  const room = project.rooms.find((r) => r.id === view.roomId);
  const storey = project.storeys.find((s) => s.id === view.storeyId);
  if (!p || !room || !storey) return null;
  if (which === "floor") return roundAnchor(`floor:${room.id}`, p.x, p.y);
  const top = upperSurfaceAt(room, storey, p);
  return { surface: top.surface, u: top.u, v: top.v };
}

/** Übergänge eines Wandankers: Nachbarwände an den fertigen Ecken, Decke/Schräge, Boden. */
function wallEdgeAnchors(project: Project, anchor: Anchor): Anchor[] {
  const t = EDGE_TOLERANCE_MM;
  const view = roomViewAt(project, anchor.surface, anchor.u);
  if (!view) return [];
  const result: Anchor[] = [];
  const byKey = new Map(derived(project).views.map((v) => [v.key, v]));
  const corner = (neighborKey: string | null, at: "uFrom" | "uTo") => {
    const n = neighborKey ? byKey.get(neighborKey) : undefined;
    if (!n) return;
    const v = anchor.v + view.floorBuildupMm - n.floorBuildupMm;
    result.push(roundAnchor(n.ref, n.finished[at], v));
  };
  if (Math.abs(anchor.u - view.finished.uTo) <= t) corner(view.right, "uFrom");
  if (Math.abs(anchor.u - view.finished.uFrom) <= t) corner(view.left, "uTo");
  if (Math.abs(anchor.v - topAt(view, anchor.u)) <= t) {
    const h = horizontalAnchor(project, view, anchor.u, "top");
    if (h) result.push(h);
  }
  if (Math.abs(anchor.v) <= t) {
    const h = horizontalAnchor(project, view, anchor.u, "floor");
    if (h) result.push(h);
  }
  return result;
}

/** Grundrisspunkt eines Ankers auf Decke, Boden oder Schräge. */
function horizontalPlanPoint(project: Project, anchor: Anchor): Vec | null {
  const w = anchorWorld(project, anchor);
  return w ? { x: w.x, y: w.y } : null;
}

/** Übergänge eines Ankers auf Decke, Schräge oder Boden: die Wand, an deren fertiger Oberfläche er liegt. */
function horizontalEdgeAnchors(project: Project, anchor: Anchor): Anchor[] {
  const kind = surfaceKind(anchor.surface);
  const roomId = anchor.surface.split(":")[1];
  const p = horizontalPlanPoint(project, anchor);
  if (!p) return [];
  const t = EDGE_TOLERANCE_MM;
  const result: Anchor[] = [];
  for (const view of derived(project).views) {
    if (view.roomId !== roomId) continue;
    const side = derived(project).sides.get(view.ref);
    if (!side) continue;
    const u = sideU(side, p);
    if (u < view.finished.uFrom - t || u > view.finished.uTo + t) continue;
    const off = dot(sub(p, sidePoint(side, u)), side.outward);
    if (Math.abs(off - view.plasterMm) > t) continue;
    if (kind === "floor") result.push(roundAnchor(view.ref, u, 0));
    else {
      // Decke bzw. Schräge: nur, wenn diese Fläche dort die Oberkante bildet
      const top = horizontalAnchor(project, view, u, "top");
      if (top?.surface === anchor.surface) result.push(roundAnchor(view.ref, u, topAt(view, u)));
    }
  }
  return [...result, ...boundaryAnchors(project, anchor, p)];
}

/** Putzstärke eines Raums (Raumwert oder Geschossstandard). */
function roomPlaster(project: Project, roomId: string): number | null {
  const room = project.rooms.find((r) => r.id === roomId);
  const storey = room && project.storeys.find((s) => s.id === room.storeyId);
  return room && storey ? (room.plasterMm ?? storey.defaults.plasterMm) : null;
}

/**
 * Übergang über eine gedachte Raumgrenze (design.md M4): Ein Anker auf Decke oder Boden am fertigen
 * Rand entlang der Grenze hat einen Anker auf Decke bzw. Boden des Raums auf der anderen Seite.
 */
function boundaryAnchors(project: Project, anchor: Anchor, p: Vec): Anchor[] {
  const [kind, roomId] = anchor.surface.split(":");
  if (kind !== "ceiling" && kind !== "floor") return [];
  const room = project.rooms.find((r) => r.id === roomId);
  const own = roomPlaster(project, roomId!);
  if (!room || own === null) return [];
  const result: Anchor[] = [];
  for (const b of project.roomBoundaries) {
    if (b.storeyId !== room.storeyId) continue;
    const proj = projectOnSegment(p, b.start, b.end);
    if (proj.t < 0 || proj.t > 1) continue;
    if (Math.abs(proj.distance - (BOUNDARY_HALF_MM + own)) > EDGE_TOLERANCE_MM) continue;
    const away = normalize(sub(proj.point, p));
    for (const other of project.rooms) {
      if (other.id === room.id || other.storeyId !== room.storeyId) continue;
      const plaster = roomPlaster(project, other.id) ?? 0;
      const probe = add(proj.point, scale(away, BOUNDARY_HALF_MM + plaster + 5));
      if (other.polygon.length < 3 || !pointInPolygon(probe, other.polygon)) continue;
      const q = add(proj.point, scale(away, BOUNDARY_HALF_MM + plaster));
      result.push(roundAnchor(`${kind}:${other.id}`, kind === "ceiling" ? -q.x : q.x, q.y));
    }
  }
  return result;
}

/**
 * Weitere Anker eines Knotens, dessen maßgebender Anker auf einer Kante liegt (Raumecke,
 * Oberkante, Unterkante, Rand von Decke/Boden/Schräge). Ohne Kante: leer.
 */
export function edgeAnchors(project: Project, anchor: Anchor): Anchor[] {
  const kind = surfaceKind(anchor.surface);
  const found =
    kind === "wall" ? wallEdgeAnchors(project, anchor) : horizontalEdgeAnchors(project, anchor);
  // Von Wandankern aus auch die Ecke über die Decke: Knoten in der oberen Raumecke hat drei Anker
  const seen = new Set([anchor.surface]);
  const result: Anchor[] = [];
  for (const a of found) {
    if (seen.has(a.surface)) continue;
    seen.add(a.surface);
    result.push(a);
  }
  return result;
}

/** Anker eines Übergangsknotens nach dem maßgebenden ersten Anker neu abgeleitet; null ohne Kante. */
export function rederivedAnchors(project: Project, node: RouteNode): Anchor[] | null {
  const first = node.anchors[0]!;
  const others = edgeAnchors(project, first);
  if (others.length === 0) return null;
  return [first, ...others];
}

export const sameAnchors = (a: readonly Anchor[], b: readonly Anchor[]) =>
  a.length === b.length && a.every((x, i) => anchorKey(x) === anchorKey(b[i]!));

// --- Durchbrüche ---

export type PenetrationTarget = { ok: true; anchor: Anchor } | { ok: false; error: string };

function wallBuildupAt(project: Project, ref: string, u: number): number {
  return roomViewAt(project, ref, u)?.floorBuildupMm ?? 0;
}

function wallPlasterAt(project: Project, ref: string, u: number): number {
  return roomViewAt(project, ref, u)?.plasterMm ?? 0;
}

const otherSide = (ref: string) =>
  ref.replace(/:([LR])$/, (_, s: string) => (s === "L" ? ":R" : ":L"));

/** Nächsttieferes bzw. nächsthöheres Geschoss. */
function neighborStorey(project: Project, storeyId: string, dir: -1 | 1) {
  const own = project.storeys.find((s) => s.id === storeyId);
  if (!own) return undefined;
  const others = project.storeys.filter((s) =>
    dir < 0 ? s.elevationMm < own.elevationMm : s.elevationMm > own.elevationMm,
  );
  others.sort((a, b) => (dir < 0 ? b.elevationMm - a.elevationMm : a.elevationMm - b.elevationMm));
  return others[0];
}

/**
 * Gegenknoten eines Durchbruchs (design.md M3 „Durchbrüche“): Wand → gespiegelt auf der
 * anderen Seite; Boden → Decke/Schräge des Raums darunter; Decke/Schräge → Boden darüber.
 */
export function penetrationTarget(project: Project, anchor: Anchor): PenetrationTarget {
  const kind = surfaceKind(anchor.surface);
  if (kind === "wall") {
    const side = derived(project).sides.get(anchor.surface);
    if (!side) return { ok: false, error: "Wand nicht gefunden" };
    const ref = otherSide(anchor.surface);
    const u = side.length - anchor.u;
    const raw = anchor.v + wallBuildupAt(project, anchor.surface, anchor.u);
    return { ok: true, anchor: roundAnchor(ref, u, raw - wallBuildupAt(project, ref, u)) };
  }
  const p = horizontalPlanPoint(project, anchor);
  const storeyId = surfaceStoreyId(project, anchor.surface);
  if (!p || !storeyId) return { ok: false, error: "Fläche nicht gefunden" };
  const down = kind === "floor";
  const target = neighborStorey(project, storeyId, down ? -1 : 1);
  const room = target
    ? project.rooms.find(
        (r) => r.storeyId === target.id && r.polygon.length >= 3 && pointInPolygon(p, r.polygon),
      )
    : undefined;
  if (!target || !room)
    return {
      ok: false,
      error: down ? "Kein Raum unter diesem Punkt" : "Kein Raum über diesem Punkt",
    };
  if (!down) return { ok: true, anchor: roundAnchor(`floor:${room.id}`, p.x, p.y) };
  const top = upperSurfaceAt(room, target, p);
  return { ok: true, anchor: { surface: top.surface, u: top.u, v: top.v } };
}

/**
 * Länge eines Durchbruchs: Wand = Rohbaudicke + Putz der Raumseiten; Decke/Boden = Höhenunterschied
 * der beiden Anker (fertige Decke unten bis OKFF oben).
 */
export function penetrationLength(project: Project, a: Anchor, b: Anchor): number | null {
  if (surfaceKind(a.surface) === "wall") {
    const wallId = a.surface.split(":")[1];
    const wall = project.walls.find((w) => w.id === wallId);
    if (!wall) return null;
    return (
      wall.thicknessMm +
      wallPlasterAt(project, a.surface, a.u) +
      wallPlasterAt(project, b.surface, b.u)
    );
  }
  const wa = anchorWorld(project, a);
  const wb = anchorWorld(project, b);
  if (!wa || !wb) return null;
  return Math.abs(globalZ(project, wa) - globalZ(project, wb));
}

/** Fußbodenaufbau und Putz eines Raums (für Tests und Ansichten). */
export function roomFinish(project: Project, roomId: string) {
  const room = project.rooms.find((r) => r.id === roomId);
  const storey = room && project.storeys.find((s) => s.id === room.storeyId);
  return room && storey ? roomHeights(room, storey) : null;
}

// --- Segment teilen ---

/** Punkt auf dem Segment (Projektion von (u, v), auf die Strecke begrenzt), gerundet. */
export function projectOntoSegment(
  a: Anchor,
  b: Anchor,
  u: number,
  v: number,
): { u: number; v: number; t: number } {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const len2 = du * du + dv * dv;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((u - a.u) * du + (v - a.v) * dv) / len2));
  return { u: Math.round(a.u + t * du), v: Math.round(a.v + t * dv), t };
}

/**
 * Wege nach dem Teilen von `segmentId` in `partA` (an Knoten a) und `partB` (an Knoten b):
 * jede Fundstelle wird in Wegrichtung durch beide Teile ersetzt.
 */
export function splitInPaths(
  cables: readonly Cable[],
  segments: ReadonlyMap<string, RouteSegment>,
  nodes: ReadonlyMap<string, RouteNode>,
  segmentId: string,
  partA: string,
  partB: string,
): Map<string, string[]> {
  const seg = segments.get(segmentId);
  const result = new Map<string, string[]>();
  if (!seg) return result;
  const endsOf = (id: string) => {
    const s = segments.get(id);
    return s ? [s.a, s.b] : [];
  };
  for (const cable of cables) {
    if (!cable.path.includes(segmentId)) continue;
    const path: string[] = [];
    cable.path.forEach((id, i) => {
      if (id !== segmentId) return void path.push(id);
      // Eintrittsknoten: gemeinsamer Knoten mit dem Vorgänger, sonst nicht der mit dem Nachfolger,
      // sonst der Knoten am Startgerät
      let entry: string | undefined;
      const prev = cable.path[i - 1];
      const next = cable.path[i + 1];
      if (prev) entry = [seg.a, seg.b].find((n) => endsOf(prev).includes(n));
      else if (next) entry = [seg.a, seg.b].find((n) => !endsOf(next).includes(n));
      else entry = [seg.a, seg.b].find((n) => nodes.get(n)?.deviceId === cable.from.deviceId);
      path.push(...(entry === seg.b ? [partB, partA] : [partA, partB]));
    });
    result.set(cable.id, path);
  }
  return result;
}

/** Endpunkte eines Segments in Weltkoordinaten (z über Geländenull); null bei fehlenden Ankern. */
export function segmentWorldEnds(
  project: Project,
  segment: RouteSegment,
  nodes: ReadonlyMap<string, RouteNode>,
): { a: World3; b: World3; za: number; zb: number } | null {
  const na = nodes.get(segment.a);
  const nb = nodes.get(segment.b);
  if (!na || !nb) return null;
  const pick = (n: RouteNode) =>
    segment.kind === "surface" && segment.surface ? anchorOn(n, segment.surface) : n.anchors[0];
  const aa = pick(na);
  const ab = pick(nb);
  if (!aa || !ab) return null;
  const a = anchorWorld(project, aa);
  const b = anchorWorld(project, ab);
  if (!a || !b) return null;
  return { a, b, za: globalZ(project, a), zb: globalZ(project, b) };
}
