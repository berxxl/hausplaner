/**
 * Schrägen und Deckenhöhe (design.md „Schrägen und Deckenhöhe“). Frei von React.
 * d(p) = Abstand zur Grundlinie, positiv zur Seite des Raumschwerpunkts; h_s(p) = heightAtBaseMm + d · tan(angle).
 * Rohdecke H(p) = min(Rohbauhöhe − Abhängung, alle h_s(p)); fertige Decke = H(p) − Putz.
 */
import type { Room, Slope, Storey } from "../model/types";
import { centroid } from "./polygon";
import { cross, distance, normalize, sub, toRad, type Vec } from "./vec";

/** Abstand des Schwerpunkts zur Grundlinie, unter dem die Schräge ungültig ist (mm). */
export const SLOPE_MIN_CENTROID_DISTANCE_MM = 1;

/** Vorzeichenbehafteter Abstand zur Geraden der Grundlinie (positiv links von baseLine[0] → baseLine[1]). */
function signedDistance(slope: Slope, p: Vec): number {
  const [a, b] = slope.baseLine;
  return cross(normalize(sub(b, a)), sub(p, a));
}

export function isSlopeValid(slope: Slope, roomPolygon: readonly Vec[]): boolean {
  const [a, b] = slope.baseLine;
  if (distance(a, b) === 0) return false;
  return Math.abs(signedDistance(slope, centroid(roomPolygon))) >= SLOPE_MIN_CENTROID_DISTANCE_MM;
}

/** Höhe der Unterseite der Rohschräge über OK Rohfußboden an p. */
export function slopeHeight(slope: Slope, roomPolygon: readonly Vec[], p: Vec): number {
  const side = Math.sign(signedDistance(slope, centroid(roomPolygon))) || 1;
  const d = side * signedDistance(slope, p);
  return slope.heightAtBaseMm + d * Math.tan(toRad(slope.angleDeg));
}

export interface RoomHeights {
  floorBuildupMm: number;
  plasterMm: number;
  suspendedMm: number;
  rawHeightMm: number;
}

/** Werte des Raums, fehlende aus dem Geschoss. */
export function roomHeights(
  room: Pick<Room, "floorBuildupMm" | "plasterMm" | "suspendedMm">,
  storey: Storey,
): RoomHeights {
  return {
    floorBuildupMm: room.floorBuildupMm ?? storey.defaults.floorBuildupMm,
    plasterMm: room.plasterMm ?? storey.defaults.plasterMm,
    suspendedMm: room.suspendedMm ?? storey.defaults.suspendedMm,
    rawHeightMm: storey.rawHeightMm,
  };
}

/** Rohdecke über OK Rohfußboden an p (gültige Schrägen). */
export function rawCeilingAt(room: Room, storey: Storey, p: Vec): number {
  const h = roomHeights(room, storey);
  let ceiling = h.rawHeightMm - h.suspendedMm;
  for (const s of room.slopes ?? []) {
    if (isSlopeValid(s, room.polygon)) ceiling = Math.min(ceiling, slopeHeight(s, room.polygon, p));
  }
  return ceiling;
}

/** Fertige Decke über OKFF an p. */
export function finishedCeilingAboveFloor(room: Room, storey: Storey, p: Vec): number {
  const h = roomHeights(room, storey);
  return rawCeilingAt(room, storey, p) - h.plasterMm - h.floorBuildupMm;
}
