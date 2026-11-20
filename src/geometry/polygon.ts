/** Polygon-Hilfen und kanonische Form (design.md „Räume“, „Kanonisches Polygon“). Frei von React. */
import { roundMm } from "../model/rounding";
import { angleDeg, distance, projectOnSegment, sub, type Vec } from "./vec";

/** Doppelte Fläche mit Vorzeichen (positiv = gegen den Uhrzeigersinn, y nach oben). */
export function signedArea2(poly: readonly Vec[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

export const area = (poly: readonly Vec[]): number => Math.abs(signedArea2(poly)) / 2;

export function centroid(poly: readonly Vec[]): Vec {
  const a2 = signedArea2(poly);
  if (a2 === 0) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (3 * a2), y: cy / (3 * a2) };
}

/** Punkt im Polygon (gerade-ungerade-Regel); Punkte auf dem Rand zählen als innen. */
export function pointInPolygon(p: Vec, poly: readonly Vec[]): boolean {
  if (distanceToBoundary(p, poly) < 1e-9) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

export function distanceToBoundary(p: Vec, poly: readonly Vec[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const { t } = projectOnSegment(p, a, b);
    const q = t <= 0 ? a : t >= 1 ? b : projectOnSegment(p, a, b).point;
    best = Math.min(best, distance(p, q));
  }
  return best;
}

/** Richtungsänderung bis zu diesem Winkel gilt als kollinear. */
export const COLLINEAR_DEG = 0.5;

function turnDeg(a: Vec, b: Vec, c: Vec): number {
  const d = Math.abs(angleDeg(sub(c, b)) - angleDeg(sub(b, a)));
  return Math.min(d, 360 - d);
}

/**
 * Kanonische Form: auf mm runden, doppelte und kollineare Punkte (≤ 0,5°) entfernen, gegen den
 * Uhrzeigersinn, Start beim Punkt mit kleinstem y, bei Gleichstand kleinstem x.
 */
export function canonicalPolygon(poly: readonly Vec[]): Vec[] {
  let pts = poly.map((p) => ({ x: roundMm(p.x), y: roundMm(p.y) }));
  pts = pts.filter((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return pts.length === 1 || p.x !== q.x || p.y !== q.y;
  });
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length]!;
      const b = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      if ((a.x === b.x && a.y === b.y) || turnDeg(a, b, c) <= COLLINEAR_DEG) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (signedArea2(pts) < 0) pts.reverse();
  let start = 0;
  pts.forEach((p, i) => {
    const s = pts[start]!;
    if (p.y < s.y || (p.y === s.y && p.x < s.x)) start = i;
  });
  return [...pts.slice(start), ...pts.slice(0, start)];
}
