/**
 * Wände: Anschlüsse (aus der Geometrie bestimmt, nie gespeichert), Wandkörper mit Gehrungen,
 * Zeichenmodi und Fang (design.md „Wände“). Frei von React.
 */
import {
  add,
  angleDeg,
  distance,
  intersectLines,
  length,
  normalize,
  perpLeft,
  projectOnSegment,
  scale,
  sub,
  type Vec,
} from "./vec";

/** Toleranz für Eck- und T-Anschluss sowie Lücken (mm). */
export const CONNECT_TOLERANCE_MM = 20;
/** Orthogonaler Fang bis zu dieser Abweichung (Grad). */
export const ORTHO_SNAP_DEG = 5;

export interface WallGeom {
  id: string;
  start: Vec;
  end: Vec;
  thicknessMm: number;
}

export type WallEnd = "start" | "end";
export interface EndRef {
  wallId: string;
  end: WallEnd;
}

export const endPoint = (w: WallGeom, end: WallEnd): Vec => (end === "start" ? w.start : w.end);
export const otherEnd = (end: WallEnd): WallEnd => (end === "start" ? "end" : "start");

/** Wandenden mit Eckanschluss an diesem Ende (Endpunkte ≤ 20 mm auseinander), ohne die Wand selbst. */
export function cornerNeighbors(
  walls: readonly WallGeom[],
  wall: WallGeom,
  end: WallEnd,
): EndRef[] {
  const p = endPoint(wall, end);
  const result: EndRef[] = [];
  for (const w of walls) {
    if (w.id === wall.id) continue;
    for (const e of ["start", "end"] as const) {
      if (distance(endPoint(w, e), p) <= CONNECT_TOLERANCE_MM)
        result.push({ wallId: w.id, end: e });
    }
  }
  return result;
}

/** Liegt der Punkt im Inneren der Achse (≤ 20 mm Abstand, nicht an deren Enden)? */
export function onAxisInterior(p: Vec, wall: WallGeom, tolerance = CONNECT_TOLERANCE_MM): boolean {
  const len = distance(wall.start, wall.end);
  if (len === 0) return false;
  const { t, distance: d } = projectOnSegment(p, wall.start, wall.end);
  if (d > tolerance) return false;
  const along = t * len;
  return along > tolerance && along < len - tolerance;
}

/** Wandenden mit T-Anschluss an die Achse dieser Wand. */
export function tConnections(walls: readonly WallGeom[], wall: WallGeom): EndRef[] {
  const result: EndRef[] = [];
  for (const w of walls) {
    if (w.id === wall.id) continue;
    for (const e of ["start", "end"] as const) {
      if (onAxisInterior(endPoint(w, e), wall)) result.push({ wallId: w.id, end: e });
    }
  }
  return result;
}

/** Hat dieses Wandende einen Anschluss (Ecke oder T)? */
export function isConnected(walls: readonly WallGeom[], wall: WallGeom, end: WallEnd): boolean {
  const p = endPoint(wall, end);
  if (cornerNeighbors(walls, wall, end).length > 0) return true;
  return walls.some((w) => w.id !== wall.id && onAxisInterior(p, w));
}

interface JointMember {
  wall: WallGeom;
  end: WallEnd;
  /** Richtung vom Knoten weg (Einheitsvektor) */
  u: Vec;
  angle: number;
}

/** Ecken eines Wandendes: links/rechts bezogen auf die Richtung vom Knoten weg. */
function jointCorners(
  walls: readonly WallGeom[],
  wall: WallGeom,
  end: WallEnd,
): { left: Vec; right: Vec } {
  const p = endPoint(wall, end);
  const member = (w: WallGeom, e: WallEnd): JointMember => {
    const u = normalize(e === "start" ? sub(w.end, w.start) : sub(w.start, w.end));
    return { wall: w, end: e, u, angle: angleDeg(u) };
  };
  const self = member(wall, end);
  const square = {
    left: add(p, scale(perpLeft(self.u), wall.thicknessMm / 2)),
    right: add(p, scale(perpLeft(self.u), -wall.thicknessMm / 2)),
  };
  const neighbors = cornerNeighbors(walls, wall, end);
  if (neighbors.length === 0) return square;
  const byId = new Map(walls.map((w) => [w.id, w]));
  const members = [self, ...neighbors.map((n) => member(byId.get(n.wallId)!, n.end))].sort(
    (a, b) => a.angle - b.angle,
  );
  const i = members.indexOf(self);
  const next = members[(i + 1) % members.length]!;
  const prev = members[(i - 1 + members.length) % members.length]!;
  const edge = (m: JointMember, side: 1 | -1): { p: Vec; d: Vec } => ({
    p: add(endPoint(m.wall, m.end), scale(perpLeft(m.u), (side * m.wall.thicknessMm) / 2)),
    d: m.u,
  });
  const limit = 4 * Math.max(...members.map((m) => m.wall.thicknessMm));
  const corner = (a: { p: Vec; d: Vec }, b: { p: Vec; d: Vec }, fallback: Vec): Vec => {
    if (next === self) return fallback;
    const x = intersectLines(a.p, a.d, b.p, b.d);
    // parallel (kollinear) oder zu spitze Gehrung: rechtwinkliges Ende
    return x && distance(x, p) <= limit ? x : fallback;
  };
  return {
    left: corner(edge(self, 1), edge(next, -1), square.left),
    right: corner(edge(self, -1), edge(prev, 1), square.right),
  };
}

/**
 * Wandkörper als Polygon gegen den Uhrzeigersinn: [Anfang rechts, Ende rechts, Ende links, Anfang links],
 * links/rechts bezogen auf start → end. Eckanschlüsse erhalten Gehrungen, T-Anschlüsse und freie Enden sind rechtwinklig.
 */
export function wallBody(walls: readonly WallGeom[], wall: WallGeom): Vec[] {
  const s = jointCorners(walls, wall, "start");
  const e = jointCorners(walls, wall, "end");
  // Am Ende zeigt „vom Knoten weg“ gegen die Wandrichtung: links/rechts tauschen
  return [s.right, e.left, e.right, s.left];
}

export type DrawMode = "axis" | "left" | "right";

/** Achse aus der gezeichneten Linie: im Kantenmodus um die halbe Dicke zur Achse versetzt. */
export function axisFromDrawn(
  a: Vec,
  b: Vec,
  thicknessMm: number,
  mode: DrawMode,
): { start: Vec; end: Vec } {
  if (mode === "axis") return { start: a, end: b };
  const n = perpLeft(normalize(sub(b, a)));
  // linke Kante gezeichnet → Achse liegt rechts davon
  const offset = scale(n, mode === "left" ? -thicknessMm / 2 : thicknessMm / 2);
  return { start: add(a, offset), end: add(b, offset) };
}

export type SnapKind = "endpoint" | "axis" | "orthogonal" | "none";

/**
 * Fang beim Zeichnen: Wandenden haben Vorrang, dann Achsen; mit Ausgangspunkt `from` wird eine Richtung
 * bis 5° Abweichung auf waagerecht/senkrecht gesetzt (auch zusammen mit dem Achsfang).
 */
export function snapPoint(
  p: Vec,
  walls: readonly WallGeom[],
  radiusMm: number,
  from?: Vec,
): { point: Vec; kind: SnapKind; orthogonal: boolean } {
  let best: Vec | null = null;
  let bestD = radiusMm;
  for (const w of walls) {
    for (const q of [w.start, w.end]) {
      const d = distance(p, q);
      if (d <= bestD) {
        best = q;
        bestD = d;
      }
    }
  }
  if (best) return { point: { ...best }, kind: "endpoint", orthogonal: false };

  let q = p;
  let orthoDir: Vec | null = null;
  if (from && distance(p, from) > 0) {
    const ang = angleDeg(sub(p, from));
    const nearest = Math.round(ang / 90) * 90;
    if (Math.abs(ang - nearest) <= ORTHO_SNAP_DEG) {
      const r = (nearest * Math.PI) / 180;
      orthoDir = { x: Math.round(Math.cos(r)), y: Math.round(Math.sin(r)) };
      q = add(from, scale(orthoDir, projectOnSegment(p, from, add(from, orthoDir)).t));
    }
  }

  let axisHit: Vec | null = null;
  let axisD = radiusMm;
  for (const w of walls) {
    if (length(sub(w.end, w.start)) === 0) continue;
    const proj = projectOnSegment(q, w.start, w.end);
    if (proj.t < 0 || proj.t > 1 || proj.distance > axisD) continue;
    let hit = proj.point;
    if (orthoDir && from) {
      const x = intersectLines(from, orthoDir, w.start, sub(w.end, w.start));
      if (x && distance(x, q) <= radiusMm) hit = x;
    }
    axisHit = hit;
    axisD = proj.distance;
  }
  if (axisHit) return { point: axisHit, kind: "axis", orthogonal: !!orthoDir };
  return { point: q, kind: orthoDir ? "orthogonal" : "none", orthogonal: !!orthoDir };
}
