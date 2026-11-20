/** Kleine Vektorhilfen. Frei von React. */
export interface Vec {
  x: number;
  y: number;
}

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const length = (a: Vec): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Drehung gegen den Uhrzeigersinn (y nach oben). */
export function rotate(a: Vec, deg: number): Vec {
  const r = toRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: c * a.x - s * a.y, y: s * a.x + c * a.y };
}

export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const perpLeft = (a: Vec): Vec => ({ x: -a.y, y: a.x });

export function normalize(a: Vec): Vec {
  const l = Math.hypot(a.x, a.y);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Schnittpunkt zweier Geraden (Punkt + Richtung); null bei (fast) parallelen Geraden. */
export function intersectLines(p: Vec, d: Vec, q: Vec, e: Vec): Vec | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9 * Math.max(1, length(d) * length(e))) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, scale(d, t));
}

/** Parameter t der Projektion von p auf a→b (0 = a, 1 = b) und Abstand zur Geraden. */
export function projectOnSegment(
  p: Vec,
  a: Vec,
  b: Vec,
): { t: number; point: Vec; distance: number } {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 === 0 ? 0 : dot(sub(p, a), ab) / len2;
  const point = add(a, scale(ab, t));
  return { t, point, distance: distance(p, point) };
}

/** Winkel in Grad (0–360) einer Richtung, gegen den Uhrzeigersinn ab +x. */
export function angleDeg(a: Vec): number {
  const deg = (Math.atan2(a.y, a.x) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}
