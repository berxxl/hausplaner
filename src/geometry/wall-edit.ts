/**
 * Wandbearbeitung mit Anschlussregeln (design.md „Wände“): Endpunkt verschieben bzw. Länge ändern,
 * parallel verschieben. Liefert neue Achsen und gelöste T-Anschlüsse. Frei von React.
 */
import { roundMm } from "../model/rounding";
import {
  angleDeg,
  distance,
  intersectLines,
  normalize,
  perpLeft,
  projectOnSegment,
  scale,
  add,
  sub,
  type Vec,
} from "./vec";
import {
  CONNECT_TOLERANCE_MM,
  cornerNeighbors,
  endPoint,
  otherEnd,
  tConnections,
  type EndRef,
  type WallEnd,
  type WallGeom,
} from "./walls";

/** Abweichung, bis zu der zwei Wände als kollinear gelten (Grad). */
export const COLLINEAR_WALL_DEG = 0.5;

export interface WallEditResult {
  /** Neue Achsen der geänderten Wände (gerundet auf mm). */
  changes: Map<string, { start: Vec; end: Vec }>;
  /** Gelöste T-Anschlüsse; die betroffenen Wände bleiben unverändert. */
  released: EndRef[];
}

const roundPt = (p: Vec): Vec => ({ x: roundMm(p.x), y: roundMm(p.y) });

class Edit {
  readonly byId: Map<string, WallGeom>;
  readonly changes = new Map<string, { start: Vec; end: Vec }>();
  readonly released: EndRef[] = [];
  constructor(readonly walls: readonly WallGeom[]) {
    this.byId = new Map(walls.map((w) => [w.id, w]));
  }
  current(id: string): { start: Vec; end: Vec } {
    const w = this.byId.get(id)!;
    return this.changes.get(id) ?? { start: w.start, end: w.end };
  }
  setEnd(id: string, end: WallEnd, p: Vec) {
    const c = { ...this.current(id) };
    c[end] = p;
    this.changes.set(id, c);
  }
  /** Angeschlossenes Ende behält die Richtung und folgt der neuen Achse; außerhalb ± 20 mm wird gelöst. */
  follow(ref: EndRef, axis: { start: Vec; end: Vec }) {
    const w = this.byId.get(ref.wallId)!;
    const fixed = endPoint(w, otherEnd(ref.end));
    const dir = sub(endPoint(w, ref.end), fixed);
    const x = intersectLines(fixed, dir, axis.start, sub(axis.end, axis.start));
    const len = distance(axis.start, axis.end);
    if (x) {
      const along = projectOnSegment(x, axis.start, axis.end).t * len;
      if (along >= -CONNECT_TOLERANCE_MM && along <= len + CONNECT_TOLERANCE_MM) {
        this.setEnd(ref.wallId, ref.end, roundPt(x));
        return;
      }
    }
    this.released.push(ref);
  }
  result(): WallEditResult {
    const changes = new Map<string, { start: Vec; end: Vec }>();
    for (const [id, c] of this.changes)
      changes.set(id, { start: roundPt(c.start), end: roundPt(c.end) });
    return { changes, released: this.released };
  }
}

/**
 * Endpunkt verschieben: Eck-Nachbarn an diesem Endpunkt erhalten denselben neuen Endpunkt; Wände mit
 * T-Anschluss an die bewegte Wand behalten ihre Richtung und folgen der neuen Achse oder werden gelöst.
 */
export function moveEndpoint(
  walls: readonly WallGeom[],
  wallId: string,
  end: WallEnd,
  to: Vec,
): WallEditResult {
  const edit = new Edit(walls);
  const wall = edit.byId.get(wallId)!;
  const target = roundPt(to);
  const corners = cornerNeighbors(walls, wall, end);
  const tees = tConnections(walls, wall);
  edit.setEnd(wallId, end, target);
  for (const c of corners) edit.setEnd(c.wallId, c.end, target);
  const axis = edit.current(wallId);
  for (const t of tees) edit.follow(t, axis);
  return edit.result();
}

/** Länge ändern: der Endpunkt `end` wandert entlang der Achse, der Anfangspunkt bleibt. */
export function setWallLength(
  walls: readonly WallGeom[],
  wallId: string,
  lengthMm: number,
): WallEditResult {
  const w = walls.find((x) => x.id === wallId)!;
  const dir = normalize(sub(w.end, w.start));
  return moveEndpoint(walls, wallId, "end", add(w.start, scale(dir, lengthMm)));
}

function nearlyParallel(a: WallGeom, b: WallGeom): boolean {
  const d = Math.abs(angleDeg(sub(a.end, a.start)) - angleDeg(sub(b.end, b.start))) % 180;
  return Math.min(d, 180 - d) <= COLLINEAR_WALL_DEG;
}

/** Kette kollinearer Wände: Eckanschluss, ≤ 0,5° Abweichung, Achsabstand ≤ 20 mm; transitiv. */
export function collinearChain(walls: readonly WallGeom[], wallId: string): string[] {
  const byId = new Map(walls.map((w) => [w.id, w]));
  const chain = new Set([wallId]);
  const queue = [wallId];
  while (queue.length > 0) {
    const w = byId.get(queue.shift()!)!;
    for (const end of ["start", "end"] as const) {
      for (const n of cornerNeighbors(walls, w, end)) {
        if (chain.has(n.wallId)) continue;
        const o = byId.get(n.wallId)!;
        const far = endPoint(o, otherEnd(n.end));
        if (
          nearlyParallel(w, o) &&
          projectOnSegment(far, w.start, w.end).distance <= CONNECT_TOLERANCE_MM
        ) {
          chain.add(o.id);
          queue.push(o.id);
        }
      }
    }
  }
  return [...chain].sort();
}

/**
 * Parallel verschieben um `offsetMm` senkrecht zur Achse (positiv nach links bezogen auf start → end).
 * Kollineare Nachbarn werden mitverschoben; Wände mit Eck- oder T-Anschluss behalten ihre Richtung.
 */
export function moveParallel(
  walls: readonly WallGeom[],
  wallId: string,
  offsetMm: number,
): WallEditResult {
  const edit = new Edit(walls);
  const wall = edit.byId.get(wallId)!;
  const delta = scale(perpLeft(normalize(sub(wall.end, wall.start))), offsetMm);
  const chain = collinearChain(walls, wallId);
  const inChain = new Set(chain);
  const followers: { ref: EndRef; axisOf: string }[] = [];
  for (const id of chain) {
    const w = edit.byId.get(id)!;
    for (const end of ["start", "end"] as const) {
      for (const n of cornerNeighbors(walls, w, end))
        if (!inChain.has(n.wallId)) followers.push({ ref: n, axisOf: id });
    }
    for (const t of tConnections(walls, w))
      if (!inChain.has(t.wallId)) followers.push({ ref: t, axisOf: id });
  }
  for (const id of chain) {
    const w = edit.byId.get(id)!;
    edit.changes.set(id, { start: add(w.start, delta), end: add(w.end, delta) });
  }
  const done = new Set<string>();
  for (const { ref, axisOf } of followers) {
    const key = `${ref.wallId}:${ref.end}`;
    if (done.has(key)) continue;
    done.add(key);
    edit.follow(ref, edit.current(axisOf));
  }
  return edit.result();
}
