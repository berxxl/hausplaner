/** Lage einer Öffnung im Grundriss und Standardmaße. Frei von React. */
import type { Opening } from "../model/types";
import { add, distance, normalize, perpLeft, scale, sub, type Vec } from "./vec";
import type { WallGeom } from "./walls";

/** Rohbauöffnung im Grundriss als Rechteck über die ganze Wanddicke. */
export function openingFootprint(
  wall: WallGeom,
  opening: Pick<Opening, "offsetMm" | "widthMm">,
): Vec[] {
  const len = distance(wall.start, wall.end);
  const d = normalize(sub(wall.end, wall.start));
  const n = scale(perpLeft(d), wall.thicknessMm / 2);
  const a = Math.max(0, Math.min(len, opening.offsetMm));
  const b = Math.max(0, Math.min(len, opening.offsetMm + opening.widthMm));
  const p = add(wall.start, scale(d, a));
  const q = add(wall.start, scale(d, b));
  return [sub(p, n), sub(q, n), add(q, n), add(p, n)];
}

/** Ragt die Öffnung über die Wand hinaus? Dann wird sie abgeschnitten dargestellt. */
export function openingClipped(
  wall: WallGeom,
  opening: Pick<Opening, "offsetMm" | "widthMm">,
): boolean {
  return (
    opening.offsetMm < 0 || opening.offsetMm + opening.widthMm > distance(wall.start, wall.end)
  );
}

export const OPENING_DEFAULTS: Record<
  Opening["kind"],
  { widthMm: number; heightMm: number; sillMm: number }
> = {
  window: { widthMm: 1010, heightMm: 1385, sillMm: 900 },
  door: { widthMm: 885, heightMm: 2135, sillMm: 0 },
  opening: { widthMm: 1010, heightMm: 2135, sillMm: 0 },
};

export const OPENING_LABELS: Record<Opening["kind"], string> = {
  window: "Fenster",
  door: "Tür",
  opening: "Durchgang",
};
