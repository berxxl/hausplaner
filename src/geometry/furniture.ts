/**
 * Geometrie der Möbel (design.md M2 „Möbel“): Grundfläche, Einrasten an Wandseiten, Silhouette in
 * Wandansichten. (x, y) ist die Mitte der Grundfläche; im lokalen System liegt die Breite entlang x,
 * die Tiefe entlang y, die Rückseite bei lokal +y·Tiefe/2; Drehung gegen den Uhrzeigersinn. Frei von React.
 */
import type { Furniture, Project, Room, Storey } from "../model/types";
import { roundDeg } from "../model/rounding";
import { pointInPolygon } from "./polygon";
import { sections, sidePoint, sideU, wallSides, type Section, type WallSide } from "./surfaces";
import { add, angleDeg, dot, rotate, scale, sub, type Vec } from "./vec";

/** Höchster Abstand der Rückseite zur fertigen Wandoberfläche, bis zu dem ein Möbel einrastet. */
export const SNAP_DISTANCE_MM = 200;
/** Höchste Abweichung von der Wandrichtung beim Einrasten. */
export const SNAP_ANGLE_DEG = 15;
/** Ein Möbel grenzt an eine Wandseite, wenn es höchstens so weit vor der fertigen Oberfläche beginnt. */
export const ADJACENT_DISTANCE_MM = 100;

type Pose = Pick<Furniture, "x" | "y" | "rotationDeg" | "widthMm" | "depthMm">;

/** Ecken der Grundfläche gegen den Uhrzeigersinn, beginnend vorn links (lokal −x/−y). */
export function footprint(f: Pose): Vec[] {
  const w = f.widthMm / 2;
  const d = f.depthMm / 2;
  const c = { x: f.x, y: f.y };
  return [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ].map((p) => add(c, rotate(p, f.rotationDeg)));
}

/** Richtung von der Mitte zur Rückseite. */
export const backDir = (rotationDeg: number): Vec => rotate({ x: 0, y: 1 }, rotationDeg);

/** Raum, in dem die Mitte des Möbels liegt. */
export function furnitureRoom(project: Project, f: Furniture): Room | undefined {
  return project.rooms.find(
    (r) =>
      r.storeyId === f.storeyId &&
      r.polygon.length >= 3 &&
      pointInPolygon({ x: f.x, y: f.y }, r.polygon),
  );
}

/** Unterkante über Rohfußboden des Geschosses: elevation über OKFF des Raums der Mitte (ohne Raum: roh). */
export function furnitureBaseZ(project: Project, f: Furniture): number {
  const room = furnitureRoom(project, f);
  const storey = project.storeys.find((s) => s.id === f.storeyId);
  const buildup = room && storey ? (room.floorBuildupMm ?? storey.defaults.floorBuildupMm) : 0;
  return buildup + f.elevationMm;
}

const plasterOf = (project: Project, storey: Storey | undefined, sec: Section | undefined) => {
  const room = sec && project.rooms.find((r) => r.id === sec.roomId);
  return room && storey ? (room.plasterMm ?? storey.defaults.plasterMm) : 0;
};

const normDeg = (deg: number) => ((deg % 360) + 360) % 360;
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(normDeg(a) - normDeg(b));
  return Math.min(d, 360 - d);
};

/**
 * Eingerastete Lage oder null: Rückseite höchstens 200 mm von einer fertigen Wandoberfläche entfernt
 * und höchstens 15° von deren Richtung abweichend → parallel, Rückseite bündig auf der fertigen Oberfläche.
 */
export function snapFurniture(
  project: Project,
  storeyId: string,
  f: Pose,
): { x: number; y: number; rotationDeg: number } | null {
  const storey = project.storeys.find((s) => s.id === storeyId);
  const sides = wallSides(project, storeyId);
  const secs = sections(project, storeyId, sides);
  const back = add({ x: f.x, y: f.y }, scale(backDir(f.rotationDeg), f.depthMm / 2));
  const center = { x: f.x, y: f.y };
  let best: { side: WallSide; plaster: number; d: number; rot: number } | null = null;
  for (const side of sides) {
    const u = sideU(side, back);
    if (u < side.uMin || u > side.uMax) continue;
    // Rückseite zeigt zur Wand: lokal +y = −outward
    const rot = normDeg(angleDeg(scale(side.outward, -1)) - 90);
    if (angleDiff(rot, f.rotationDeg) > SNAP_ANGLE_DEG) continue;
    const plaster = plasterOf(
      project,
      storey,
      secs.find((s) => s.ref === side.ref && u >= s.uFrom && u <= s.uTo),
    );
    // Abstand vor der fertigen Oberfläche; die Mitte muss davor liegen
    const d = dot(sub(back, side.origin), side.outward) - plaster;
    if (dot(sub(center, side.origin), side.outward) - plaster <= 0) continue;
    if (Math.abs(d) > SNAP_DISTANCE_MM) continue;
    if (!best || Math.abs(d) < Math.abs(best.d)) best = { side, plaster, d, rot };
  }
  if (!best) return null;
  const u = sideU(best.side, center);
  const p = add(sidePoint(best.side, u), scale(best.side.outward, best.plaster + f.depthMm / 2));
  return { x: Math.round(p.x) + 0, y: Math.round(p.y) + 0, rotationDeg: roundDeg(best.rot) };
}

/** Projektion eines Möbels auf eine Wandseite (u-Bereich × Höhe über OKFF des Bezugsraums). */
export interface Silhouette {
  furnitureId: string;
  uFrom: number;
  uTo: number;
  vFrom: number;
  vTo: number;
}

/**
 * Silhouette eines Möbels auf einer Wandseite oder null. Es grenzt an, wenn seine Grundfläche höchstens
 * 100 mm vor der fertigen Oberfläche (Rohbau + `plasterMm`) beginnt und sich mit `uRange` überlappt.
 * `floorBuildupMm` ist der Fußbodenaufbau, auf den sich v bezieht.
 */
export function silhouetteOn(
  project: Project,
  side: WallSide,
  plasterMm: number,
  floorBuildupMm: number,
  uRange: [number, number],
  f: Furniture,
): Silhouette | null {
  const corners = footprint(f);
  const ds = corners.map((p) => dot(sub(p, side.origin), side.outward) - plasterMm);
  const near = Math.min(...ds);
  if (near > ADJACENT_DISTANCE_MM || Math.max(...ds) <= 0) return null;
  const us = corners.map((p) => sideU(side, p));
  const uFrom = Math.max(uRange[0], Math.min(...us));
  const uTo = Math.min(uRange[1], Math.max(...us));
  if (uTo <= uFrom) return null;
  const vFrom = furnitureBaseZ(project, f) - floorBuildupMm;
  return { furnitureId: f.id, uFrom, uTo, vFrom, vTo: vFrom + f.heightMm };
}

/** Silhouetten aller Möbel des Geschosses vor einem Raumabschnitt einer Wandseite (fertige Maße). */
export function sectionSilhouettes(
  project: Project,
  view: { ref: string; storeyId: string; finished: { uFrom: number; uTo: number } } & {
    plasterMm: number;
    floorBuildupMm: number;
  },
): Silhouette[] {
  const side = wallSides(project, view.storeyId).find((s) => s.ref === view.ref);
  if (!side) return [];
  return project.furniture
    .filter((f) => f.storeyId === view.storeyId)
    .map((f) =>
      silhouetteOn(
        project,
        side,
        view.plasterMm,
        view.floorBuildupMm,
        [view.finished.uFrom, view.finished.uTo],
        f,
      ),
    )
    .filter((s): s is Silhouette => s !== null);
}
