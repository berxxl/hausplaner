/**
 * Geometrie der 3D-Ansicht in Rohbaumaßen (design.md „3D aus denselben Daten“, „Schrägen und Deckenhöhe“).
 * Liefert Profile und Polygone; trianguliert wird in der Ansicht. Frei von React.
 */
import type { Project, Room, Storey, Wall } from "../model/types";
import { isSlopeValid, roomHeights, slopeHeight } from "./ceiling";
import { slopeFrame, slopeOutline, sections } from "./surfaces";
import { add, distance, dot, normalize, perpLeft, scale, sub, toRad, type Vec } from "./vec";
import { wallBody, type WallGeom } from "./walls";

export interface ProfilePoint {
  s: number;
  z: number;
}

export interface WallSolid {
  wallId: string;
  storeyId: string;
  /** Achsanfang, Richtung und linke Normale im Grundriss */
  start: Vec;
  dir: Vec;
  normal: Vec;
  thicknessMm: number;
  /** Ausdehnung entlang der Achse (über die Gehrungsecken) */
  sMin: number;
  sMax: number;
  /** Oberkante über OK Rohfußboden entlang s, gekappt an den Schrägen angrenzender Räume */
  top: ProfilePoint[];
  /** Rohbauöffnungen als Rechtecke in (s, z), auf die Wand beschnitten */
  holes: { openingId: string; s1: number; s2: number; z1: number; z2: number }[];
}

function geoms(project: Project, storeyId: string): WallGeom[] {
  return project.walls
    .filter((w) => w.storeyId === storeyId)
    .map((w) => ({ id: w.id, start: w.start, end: w.end, thicknessMm: w.thicknessMm }));
}

/** Oberkante einer Wand: Minimum aus Wandhöhe und den Schrägenebenen der angrenzenden Räume, ausgewertet an der jeweiligen Raumseite. */
export function wallTopProfile(
  project: Project,
  wall: Wall,
  sMin: number,
  sMax: number,
): ProfilePoint[] {
  const storey = project.storeys.find((s) => s.id === wall.storeyId)!;
  const height = wall.rawHeightMm ?? storey.rawHeightMm;
  const d = normalize(sub(wall.end, wall.start));
  const n = perpLeft(d);
  const secs = sections(project, wall.storeyId).filter((s) => s.ref.startsWith(`wall:${wall.id}:`));
  const lines: ((s: number) => number)[] = [() => height];
  for (const sec of secs) {
    const room = project.rooms.find((r) => r.id === sec.roomId);
    if (!room) continue;
    const sign = sec.ref.endsWith(":L") ? 1 : -1;
    const face = (s: number) =>
      add(add(wall.start, scale(d, s)), scale(n, (sign * wall.thicknessMm) / 2));
    for (const slope of room.slopes ?? []) {
      if (isSlopeValid(slope, room.polygon))
        lines.push((s) => slopeHeight(slope, room.polygon, face(s)));
    }
  }
  const lin = lines.map((f) => ({ a: f(0), b: f(1) - f(0) }));
  const at = (s: number) => Math.min(...lin.map((l) => l.a + l.b * s));
  const ss = new Set([sMin, sMax]);
  for (let i = 0; i < lin.length; i++)
    for (let j = i + 1; j < lin.length; j++) {
      const p = lin[i]!;
      const q = lin[j]!;
      if (Math.abs(p.b - q.b) < 1e-12) continue;
      const s = (q.a - p.a) / (p.b - q.b);
      if (s > sMin && s < sMax) ss.add(s);
    }
  return [...ss].sort((a, b) => a - b).map((s) => ({ s, z: Math.max(0, at(s)) }));
}

export function wallSolids(project: Project, storeyId: string): WallSolid[] {
  const gs = geoms(project, storeyId);
  return project.walls
    .filter((w) => w.storeyId === storeyId && distance(w.start, w.end) > 0)
    .map((w) => {
      const d = normalize(sub(w.end, w.start));
      const body = wallBody(
        gs,
        gs.find((g) => g.id === w.id)!,
      );
      const params = body.map((p) => dot(sub(p, w.start), d));
      const sMin = Math.min(...params);
      const sMax = Math.max(...params);
      const top = wallTopProfile(project, w, sMin, sMax);
      const len = distance(w.start, w.end);
      const holes = project.openings
        .filter((o) => o.wallId === w.id)
        .map((o) => ({
          openingId: o.id,
          s1: Math.max(0, o.offsetMm),
          s2: Math.min(len, o.offsetMm + o.widthMm),
          z1: Math.max(0, o.sillMm),
          z2: o.sillMm + o.heightMm,
        }))
        .filter((h) => h.s2 > h.s1 && h.z2 > h.z1);
      return {
        wallId: w.id,
        storeyId,
        start: w.start,
        dir: d,
        normal: perpLeft(d),
        thicknessMm: w.thicknessMm,
        sMin,
        sMax,
        top,
        holes,
      };
    });
}

/** Ebenes Polygon im Grundriss mit Höhe je Punkt (z ab OK Rohfußboden). */
export interface PlanarPolygon {
  kind: "floor" | "ceiling" | "slope";
  roomId: string;
  storeyId: string;
  outline: Vec[];
  z(p: Vec): number;
}

function clipHalfPlane(poly: Vec[], g: (p: Vec) => number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const gp = g(p);
    const gq = g(q);
    if (gp >= 0) out.push(p);
    if (gp >= 0 !== gq >= 0) out.push(add(p, scale(sub(q, p), gp / (gp - gq))));
  }
  return out;
}

/** Boden (Rohfußboden), flacher Teil der Rohdecke und Schrägen eines Raums. */
export function roomPolygons(room: Room, storey: Storey): PlanarPolygon[] {
  if (room.polygon.length < 3) return [];
  const h = roomHeights(room, storey);
  const flat = h.rawHeightMm - h.suspendedMm;
  const valid = (room.slopes ?? []).filter((s) => isSlopeValid(s, room.polygon));
  const base = { roomId: room.id, storeyId: storey.id };
  const result: PlanarPolygon[] = [{ ...base, kind: "floor", outline: room.polygon, z: () => 0 }];
  let flatOutline: Vec[] = [...room.polygon];
  for (const s of valid)
    flatOutline = clipHalfPlane(flatOutline, (p) => slopeHeight(s, room.polygon, p) - flat);
  if (flatOutline.length >= 3)
    result.push({ ...base, kind: "ceiling", outline: flatOutline, z: () => flat });
  for (const s of valid) {
    const outline = slopeOutline(room, storey, s);
    const frame = slopeFrame(room, s);
    const tan = Math.tan(toRad(s.angleDeg));
    if (outline.length >= 3)
      result.push({
        ...base,
        kind: "slope",
        outline,
        z: (p) => s.heightAtBaseMm + frame.d(p) * tan,
      });
  }
  return result;
}

/** Sichtbare Geschosse bei „bis Geschoss“: alle bis einschließlich dessen Höhenlage. */
export function visibleStoreys(project: Project, upToStoreyId: string | null): Storey[] {
  const limit = upToStoreyId
    ? project.storeys.find((s) => s.id === upToStoreyId)?.elevationMm
    : undefined;
  return project.storeys.filter((s) => limit === undefined || s.elevationMm <= limit);
}
