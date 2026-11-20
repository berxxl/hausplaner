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
