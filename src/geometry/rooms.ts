/**
 * Raumerkennung (design.md „Räume“): Vereinigung der Wandkörper, morphologisch geschlossen (+10/−10 mm),
 * freie Region um den Saatpunkt. Frei von React.
 */
import { difference, fromPath, offset, toPath, union, type Region } from "./clipper";
import { area, canonicalPolygon, distanceToBoundary, pointInPolygon } from "./polygon";
import { endPoint, isConnected, wallBody, type EndRef, type WallGeom } from "./walls";
import { add, normalize, perpLeft, scale, sub, type Vec } from "./vec";

/** Gedachte Raumgrenze als Linie (design.md M4 „Gedachte Raumgrenze“). */
export interface BoundaryLine {
  start: Vec;
  end: Vec;
}

/** Halbe Breite des Körpers einer Raumgrenze und Verlängerung an den Enden. */
export const BOUNDARY_HALF_MM = 1;

const NO_BOUNDARIES: readonly BoundaryLine[] = [];

/** Körper einer Raumgrenze: Rechteck ±1 mm um die Linie, an den Enden 1 mm länger. */
export function boundaryBody(b: BoundaryLine): Vec[] {
  const d = normalize(sub(b.end, b.start));
  if (d.x === 0 && d.y === 0) return [];
  const n = scale(perpLeft(d), BOUNDARY_HALF_MM);
  const a = sub(b.start, scale(d, BOUNDARY_HALF_MM));
  const e = add(b.end, scale(d, BOUNDARY_HALF_MM));
  return [add(a, n), add(e, n), sub(e, n), sub(a, n)];
}

/** Halbe Lückenweite, die das morphologische Schließen überbrückt. */
export const CLOSE_MM = 10;
/** Abstand der Hülle, ab dem eine Region als offen gilt. */
export const HULL_MARGIN_MM = 10000;

export type Detection =
  | { status: "closed"; polygon: Vec[]; region: Region }
  | { status: "open"; openEnds: EndRef[] }
  | { status: "in-wall" }
  | { status: "no-walls" };

interface Prepared {
  walls: readonly WallGeom[];
  regions: Region[];
  solid: Vec[][];
  hull: { min: Vec; max: Vec };
}

const cache = new WeakMap<readonly WallGeom[], WeakMap<readonly BoundaryLine[], Prepared>>();

function prepare(walls: readonly WallGeom[], boundaries: readonly BoundaryLine[]): Prepared {
  let inner = cache.get(walls);
  if (!inner) {
    inner = new WeakMap();
    cache.set(walls, inner);
  }
  const hit = inner.get(boundaries);
  if (hit) return hit;
  const bodies = [
    ...walls.map((w) => wallBody(walls, w)),
    ...boundaries.map(boundaryBody).filter((b) => b.length > 0),
  ];
  const closed = offset(offset(union(bodies), CLOSE_MM), -CLOSE_MM);
  const pts = bodies.flat();
  const min = {
    x: Math.min(...pts.map((p) => p.x)) - HULL_MARGIN_MM,
    y: Math.min(...pts.map((p) => p.y)) - HULL_MARGIN_MM,
  };
  const max = {
    x: Math.max(...pts.map((p) => p.x)) + HULL_MARGIN_MM,
    y: Math.max(...pts.map((p) => p.y)) + HULL_MARGIN_MM,
  };
  const rect = [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }];
  const prepared = {
    walls,
    regions: difference(rect, closed),
    solid: closed.map(fromPath),
    hull: { min, max },
  };
  inner.set(boundaries, prepared);
  return prepared;
}

function regionContains(region: Region, p: Vec): boolean {
  return (
    pointInPolygon(p, region.outer) &&
    !region.holes.some((h) => pointInPolygon(p, h) && distanceToBoundary(p, h) > 1e-6)
  );
}

function touchesHull(region: Region, hull: Prepared["hull"]): boolean {
  return region.outer.some(
    (p) =>
      Math.abs(p.x - hull.min.x) < 1 ||
      Math.abs(p.x - hull.max.x) < 1 ||
      Math.abs(p.y - hull.min.y) < 1 ||
      Math.abs(p.y - hull.max.y) < 1,
  );
}

/**
 * Erkennt den Raum um einen Saatpunkt. `walls` und `boundaries` sollten als stabile Referenzen
 * übergeben werden (Cache). Raumgrenzen zählen nur hier (design.md M4 „Gedachte Raumgrenze“).
 */
export function detectRoom(
  walls: readonly WallGeom[],
  seed: Vec,
  boundaries: readonly BoundaryLine[] = NO_BOUNDARIES,
): Detection {
  if (walls.length === 0) return { status: "no-walls" };
  const prep = prepare(walls, boundaries);
  const region = prep.regions.find((r) => regionContains(r, seed));
  if (!region) return { status: "in-wall" };
  if (touchesHull(region, prep.hull))
    return { status: "open", openEnds: openEndsAt(walls, region) };
  return { status: "closed", polygon: canonicalPolygon(region.outer), region };
}

/** Wandenden ohne Anschluss, deren Wandkörper an die Region grenzt. */
function openEndsAt(walls: readonly WallGeom[], region: Region): EndRef[] {
  const result: EndRef[] = [];
  const boundaries = [region.outer, ...region.holes];
  for (const w of walls) {
    for (const end of ["start", "end"] as const) {
      if (isConnected(walls, w, end)) continue;
      const p = endPoint(w, end);
      const near = boundaries.some(
        (b) => distanceToBoundary(p, b) <= w.thicknessMm / 2 + CLOSE_MM + 2,
      );
      if (near) result.push({ wallId: w.id, end });
    }
  }
  return result;
}

export interface RoomLike {
  id: string;
  seed: Vec;
  polygon: Vec[];
}

export type RoomStatus =
  | { status: "ok"; polygon: Vec[] }
  | { status: "open"; openEnds: EndRef[] }
  | { status: "in-wall" }
  | { status: "merged"; with: string[] };

/**
 * Zustand aller Räume eines Geschosses. `ok` liefert die neue Kontur; bei offen, im Wandkörper oder
 * verschmolzen bleibt die gespeicherte Kontur. Offen hat Vorrang vor verschmolzen.
 */
export function roomStatuses(
  walls: readonly WallGeom[],
  rooms: readonly RoomLike[],
  boundaries: readonly BoundaryLine[] = NO_BOUNDARIES,
): Map<string, RoomStatus> {
  const result = new Map<string, RoomStatus>();
  for (const room of rooms) {
    const d = detectRoom(walls, room.seed, boundaries);
    if (d.status === "open") result.set(room.id, { status: "open", openEnds: d.openEnds });
    else if (d.status === "in-wall" || d.status === "no-walls")
      result.set(
        room.id,
        d.status === "in-wall" ? { status: "in-wall" } : { status: "open", openEnds: [] },
      );
    else {
      const others = rooms
        .filter((r) => r.id !== room.id && regionContains(d.region, r.seed))
        .map((r) => r.id);
      result.set(
        room.id,
        others.length > 0
          ? { status: "merged", with: others }
          : { status: "ok", polygon: d.polygon },
      );
    }
  }
  return result;
}

/** Fertige Fläche in mm²: Rohbaupolygon um die Putzstärke nach innen versetzt. */
export function finishedArea(polygon: readonly Vec[], plasterMm: number): number {
  if (plasterMm <= 0) return area(polygon);
  return offset([toPath(polygon)], -plasterMm)
    .map((p) => area(fromPath(p)))
    .reduce((a, b) => a + b, 0);
}

/** Frei stehende Wand im Raum: Achsmittelpunkt im Polygon, ohne Anschluss an andere Wände. */
export function isFreeStandingIn(
  walls: readonly WallGeom[],
  wall: WallGeom,
  polygon: readonly Vec[],
): boolean {
  const mid = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
  return (
    pointInPolygon(mid, polygon) &&
    distanceToBoundary(mid, polygon) > wall.thicknessMm / 2 &&
    !isConnected(walls, wall, "start") &&
    !isConnected(walls, wall, "end")
  );
}
