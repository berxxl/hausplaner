/**
 * Abgeleitete Flächen und Raumansichten (design.md „Flächen und Ansichten“, „Angrenzung, Außenseite und
 * Benennung“). Nichts davon wird gespeichert. Frei von React.
 */
import type { Opening, Project, Room, Slope, Storey } from "../model/types";
import { isSlopeValid, rawCeilingAt, roomHeights, slopeHeight } from "./ceiling";
import { centroid } from "./polygon";
import { isFreeStandingIn } from "./rooms";
import { add, cross, distance, dot, normalize, perpLeft, scale, sub, toRad, type Vec } from "./vec";
import { wallBody, type WallGeom } from "./walls";

export type Side = "L" | "R";
export const ADJACENCY_DISTANCE_MM = 20;
export const ADJACENCY_ANGLE_DEG = 0.5;
export const MIN_OVERLAP_MM = 1;

const DIRECTIONS = [
  "Nord",
  "Nordost",
  "Ost",
  "Südost",
  "Süd",
  "Südwest",
  "West",
  "Nordwest",
] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Peilung eines Grundrissvektors in Grad (0–360) im Uhrzeigersinn ab Nord. */
export function bearing(v: Vec, northDeg: number): number {
  const t = toRad(northDeg);
  const north = { x: Math.sin(t), y: Math.cos(t) };
  const east = { x: Math.cos(t), y: -Math.sin(t) };
  const deg = (Math.atan2(dot(v, east), dot(v, north)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** Sektor 0–7 (Nord … Nordwest), halboffen [−22,5°, 22,5°) usw. */
export function sector(bearingDeg: number): number {
  return Math.floor(((((bearingDeg + 22.5) % 360) + 360) % 360) / 45) % 8;
}

export const directionName = (sectorIndex: number): Direction => DIRECTIONS[sectorIndex]!;

/** Eine Seite einer Wand mit ihrem (u, v)-System. */
export interface WallSide {
  ref: string;
  wallId: string;
  storeyId: string;
  side: Side;
  /** Achslänge */
  length: number;
  /** u-Bereich der Seitenfläche, an Gehrungen auf den Wandkörper beschnitten (kann über [0, Länge] hinausgehen). */
  uMin: number;
  uMax: number;
  /** Punkt der Seitenfläche bei u = 0 */
  origin: Vec;
  /** Richtung zunehmender u */
  uDir: Vec;
  /** Normale von der Seitenfläche weg (in den Raum davor) */
  outward: Vec;
  wallHeightMm: number;
  exterior: boolean;
}

export function sideRef(wallId: string, side: Side): string {
  return `wall:${wallId}:${side}`;
}

/** Punkt der Seitenfläche bei u. */
export const sidePoint = (s: WallSide, u: number): Vec => add(s.origin, scale(s.uDir, u));

/** u eines Grundrisspunkts auf dieser Seite. */
export const sideU = (s: WallSide, p: Vec): number => dot(sub(p, s.origin), s.uDir);

function geomsOf(project: Project, storeyId: string): WallGeom[] {
  return project.walls
    .filter((w) => w.storeyId === storeyId)
    .map((w) => ({ id: w.id, start: w.start, end: w.end, thicknessMm: w.thicknessMm }));
}

/** Beide Seiten aller Wände eines Geschosses. */
export function wallSides(project: Project, storeyId: string): WallSide[] {
  const storey = project.storeys.find((s) => s.id === storeyId);
  const geoms = geomsOf(project, storeyId);
  const sides: WallSide[] = [];
  for (const w of project.walls.filter((x) => x.storeyId === storeyId)) {
    const len = distance(w.start, w.end);
    if (len === 0) continue;
    const d = normalize(sub(w.end, w.start));
    const n = perpLeft(d);
    const half = w.thicknessMm / 2;
    const [sR, eR, eL, sL] = wallBody(
      geoms,
      geoms.find((g) => g.id === w.id)!,
    );
    const s = (p: Vec) => dot(sub(p, w.start), d);
    const height = w.rawHeightMm ?? storey?.rawHeightMm ?? 0;
    const r1 = s(sR!);
    const r2 = s(eR!);
    sides.push({
      ref: sideRef(w.id, "R"),
      wallId: w.id,
      storeyId,
      side: "R",
      length: len,
      uMin: Math.min(r1, r2),
      uMax: Math.max(r1, r2),
      origin: sub(w.start, scale(n, half)),
      uDir: d,
      outward: scale(n, -1),
      wallHeightMm: height,
      exterior: w.kind === "exterior",
    });
    const l1 = len - s(eL!);
    const l2 = len - s(sL!);
    sides.push({
      ref: sideRef(w.id, "L"),
      wallId: w.id,
      storeyId,
      side: "L",
      length: len,
      uMin: Math.min(l1, l2),
      uMax: Math.max(l1, l2),
      origin: add(w.end, scale(n, half)),
      uDir: scale(d, -1),
      outward: n,
      wallHeightMm: height,
      exterior: w.kind === "exterior",
    });
  }
  return sides;
}

/** Abschnitt einer Wandseite, der an einen Raum grenzt. */
export interface Section {
  ref: string;
  roomId: string;
  uFrom: number;
  uTo: number;
  freeStanding: boolean;
  /** Lage der Abschnittsmitte entlang des Raumumfangs (gegen den Uhrzeigersinn), für die Nachbarn. */
  perimeter: number;
}

function perimeterParams(poly: readonly Vec[]): number[] {
  const params = [0];
  for (let i = 0; i < poly.length - 1; i++)
    params.push(params[i]! + distance(poly[i]!, poly[i + 1]!));
  return params;
}

/** Abschnitte aller Wandseiten eines Geschosses, die an Räume grenzen. */
export function sections(
  project: Project,
  storeyId: string,
  sides = wallSides(project, storeyId),
): Section[] {
  const rooms = project.rooms.filter((r) => r.storeyId === storeyId && r.polygon.length >= 3);
  const geoms = geomsOf(project, storeyId);
  const sinTol = Math.sin(toRad(ADJACENCY_ANGLE_DEG));
  const result: Section[] = [];
  for (const room of rooms) {
    const poly = room.polygon;
    const params = perimeterParams(poly);
    const raw: Section[] = [];
    for (const side of sides) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!;
        const b = poly[(i + 1) % poly.length]!;
        const seg = sub(b, a);
        const segLen = Math.hypot(seg.x, seg.y);
        if (segLen === 0 || Math.abs(cross(normalize(seg), side.uDir)) > sinTol) continue;
        // Abstand zur Seitenfläche (vor der Fläche, also in Richtung outward)
        const da = dot(sub(a, side.origin), side.outward);
        const db = dot(sub(b, side.origin), side.outward);
        if (Math.abs(da) > ADJACENCY_DISTANCE_MM || Math.abs(db) > ADJACENCY_DISTANCE_MM) continue;
        const ua = sideU(side, a);
        const ub = sideU(side, b);
        const from = Math.max(Math.min(ua, ub), side.uMin);
        const to = Math.min(Math.max(ua, ub), side.uMax);
        if (to - from < MIN_OVERLAP_MM) continue;
        const along = (u: number) => params[i]! + Math.abs(u - ua);
        raw.push({
          ref: side.ref,
          roomId: room.id,
          uFrom: from,
          uTo: to,
          freeStanding: false,
          perimeter: along((from + to) / 2),
        });
      }
    }
    // zusammenhängende Abschnitte derselben Seite zusammenfassen
    raw.sort((x, y) => (x.ref < y.ref ? -1 : x.ref > y.ref ? 1 : x.uFrom - y.uFrom));
    for (const s of raw) {
      const last = result[result.length - 1];
      if (
        last &&
        last.roomId === room.id &&
        last.ref === s.ref &&
        !last.freeStanding &&
        s.uFrom <= last.uTo + MIN_OVERLAP_MM
      ) {
        last.uTo = Math.max(last.uTo, s.uTo);
      } else result.push({ ...s });
    }
    // frei stehende Wände: beide Seiten über die ganze Länge, ohne Nachbarn
    for (const g of geoms) {
      if (!isFreeStandingIn(geoms, g, poly)) continue;
      for (const side of sides.filter((x) => x.wallId === g.id)) {
        result.push({
          ref: side.ref,
          roomId: room.id,
          uFrom: side.uMin,
          uTo: side.uMax,
          freeStanding: true,
          perimeter: -1,
        });
      }
    }
  }
  return result;
}

/** Außenseite einer Außenwand: Seite ohne Raum; sonst outsideSide (Standard L). */
export function outsideSideOf(
  project: Project,
  wallId: string,
  secs: readonly Section[],
): Side | null {
  const wall = project.walls.find((w) => w.id === wallId);
  if (!wall || wall.kind !== "exterior") return null;
  const hasL = secs.some((s) => s.ref === sideRef(wallId, "L"));
  const hasR = secs.some((s) => s.ref === sideRef(wallId, "R"));
  if (hasL !== hasR) return hasL ? "R" : "L";
  return wall.outsideSide ?? "L";
}

/** Fertige Öffnung in einer Raumansicht (u, v ab OKFF) mit Rohbaumaß zum Abrufen. */
export interface ViewOpening {
  id: string;
  kind: Opening["kind"];
  /** fertige Laibungen und Höhen */
  uFrom: number;
  uTo: number;
  vFrom: number;
  vTo: number;
  raw: {
    uFrom: number;
    uTo: number;
    vFrom: number;
    vTo: number;
    widthMm: number;
    heightMm: number;
    sillMm: number;
  };
  /** Rollladenkasten, falls in dieser Ansicht sichtbar */
  shutter?: {
    uFrom: number;
    uTo: number;
    vFrom: number;
    vTo: number;
    position: "inside" | "outside" | "top";
  };
}

/** u-Bereich einer Öffnung auf einer Wandseite (Rohbau). */
export function openingURange(
  side: WallSide,
  o: Pick<Opening, "offsetMm" | "widthMm">,
): [number, number] {
  if (side.side === "R") return [o.offsetMm, o.offsetMm + o.widthMm];
  return [side.length - o.offsetMm - o.widthMm, side.length - o.offsetMm];
}

/**
 * Öffnungen einer Wandseite in Ansichtskoordinaten. `floorMm` = Fußbodenaufbau (0 für Rohfußboden-Bezug),
 * `plasterMm` = Putz der Laibungen (0 = Rohbaumaße). `outsideView` steuert, welche Rollladenkästen erscheinen.
 */
export function viewOpenings(
  project: Project,
  side: WallSide,
  floorMm: number,
  plasterMm: number,
  outsideView: boolean,
  range?: [number, number],
): ViewOpening[] {
  const result: ViewOpening[] = [];
  for (const o of project.openings.filter((x) => x.wallId === side.wallId)) {
    const [u1, u2] = openingURange(side, o);
    if (range && (u2 <= range[0] || u1 >= range[1])) continue;
    const rawV = { vFrom: o.sillMm - floorMm, vTo: o.sillMm + o.heightMm - floorMm };
    const box = o.shutterBox;
    const shutterVisible =
      box && (outsideView ? box.position === "outside" : box.position !== "outside");
    result.push({
      id: o.id,
      kind: o.kind,
      uFrom: u1 + plasterMm,
      uTo: u2 - plasterMm,
      vFrom: Math.max(0, rawV.vFrom),
      vTo: rawV.vTo - plasterMm,
      raw: {
        uFrom: u1,
        uTo: u2,
        ...rawV,
        widthMm: o.widthMm,
        heightMm: o.heightMm,
        sillMm: o.sillMm,
      },
      ...(shutterVisible && box
        ? {
            shutter: {
              uFrom: u1,
              uTo: u2,
              vFrom: rawV.vTo,
              vTo: rawV.vTo + box.heightMm,
              position: box.position,
            },
          }
        : {}),
    });
  }
  return result.sort((a, b) => a.raw.uFrom - b.raw.uFrom);
}

/** Wandansicht eines Raums: Ausschnitt einer Wandseite in fertigen Maßen. */
export interface RoomView {
  key: string;
  ref: string;
  wallId: string;
  roomId: string;
  storeyId: string;
  name: string;
  sector: number;
  number: number | null;
  freeStanding: boolean;
  /** Rohbauabschnitt auf der Wandseite */
  section: { uFrom: number; uTo: number };
  /** Fertige Raumecken */
  finished: { uFrom: number; uTo: number };
  /** Oberkante (fertige Decke über OKFF) als Knickfolge über u */
  top: { u: number; v: number }[];
  floorBuildupMm: number;
  plasterMm: number;
  openings: ViewOpening[];
  /** Grundlinie des Abschnitts im Grundriss (auf der rohen Seitenfläche) */
  base: [Vec, Vec];
  left: string | null;
  right: string | null;
}

/** Linearfunktionen der Decke entlang der Seitenfläche; das Minimum ist konkav, Knicke an den Schnitten. */
function ceilingPolyline(
  room: Room,
  storey: Storey,
  side: WallSide,
  uFrom: number,
  uTo: number,
  h: ReturnType<typeof roomHeights>,
) {
  // Oberkante: fertige Decke, bei niedrigen Wänden höchstens die Wandoberkante (beides über OKFF)
  const at = (u: number) =>
    Math.min(rawCeilingAt(room, storey, sidePoint(side, u)) - h.plasterMm, side.wallHeightMm) -
    h.floorBuildupMm;
  // Flache Decke, Wandoberkante und jede gültige Schräge sind entlang der Seitenfläche linear in u: a + b·u
  const planes: ((u: number) => number)[] = [
    () => h.rawHeightMm - h.suspendedMm,
    () => side.wallHeightMm + h.plasterMm,
    ...(room.slopes ?? [])
      .filter((x) => isSlopeValid(x, room.polygon))
      .map((x) => (u: number) => slopeHeight(x, room.polygon, sidePoint(side, u))),
  ];
  const lines = planes.map((f) => ({ a: f(0), b: f(1) - f(0) }));
  const us = new Set<number>([uFrom, uTo]);
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const p = lines[i]!;
      const q = lines[j]!;
      if (Math.abs(p.b - q.b) < 1e-12) continue;
      const u = (q.a - p.a) / (p.b - q.b);
      if (u > uFrom && u < uTo) us.add(u);
    }
  return [...us].sort((x, y) => x - y).map((u) => ({ u, v: at(u) }));
}

export const viewKey = (ref: string, roomId: string, n = 0) => `${ref}@${roomId}#${n}`;

/** Alle Raumansichten des Projekts, je Raum in Baumreihenfolge. */
export function deriveRoomViews(project: Project): Map<string, RoomView[]> {
  const result = new Map<string, RoomView[]>();
  for (const storey of project.storeys) {
    const sides = wallSides(project, storey.id);
    const byRef = new Map(sides.map((s) => [s.ref, s]));
    const secs = sections(project, storey.id, sides);
    for (const room of project.rooms.filter((r) => r.storeyId === storey.id)) {
      const h = roomHeights(room, storey);
      const c = room.polygon.length >= 3 ? centroid(room.polygon) : room.seed;
      const own = secs.filter((s) => s.roomId === room.id);
      // stabiler Schlüssel: Wandseite, Raum und laufende Nummer entlang u
      const occurrence = (s: Section) =>
        own.filter((o) => o.ref === s.ref && o.uFrom < s.uFrom).length;
      const views: RoomView[] = own
        .map((s) => {
          const side = byRef.get(s.ref)!;
          const base: [Vec, Vec] = [sidePoint(side, s.uFrom), sidePoint(side, s.uTo)];
          const finished = { uFrom: s.uFrom + h.plasterMm, uTo: s.uTo - h.plasterMm };
          return {
            key: viewKey(s.ref, room.id, occurrence(s)),
            ref: s.ref,
            wallId: side.wallId,
            roomId: room.id,
            storeyId: storey.id,
            name: "",
            sector: sector(bearing(scale(side.outward, -1), project.settings.northDeg)),
            number: null,
            freeStanding: s.freeStanding,
            section: { uFrom: s.uFrom, uTo: s.uTo },
            finished,
            top: ceilingPolyline(room, storey, side, finished.uFrom, finished.uTo, h),
            floorBuildupMm: h.floorBuildupMm,
            plasterMm: h.plasterMm,
            openings: viewOpenings(project, side, h.floorBuildupMm, h.plasterMm, false, [
              s.uFrom,
              s.uTo,
            ]),
            base,
            left: null,
            right: null,
            perimeter: s.perimeter,
            midBearing: bearing(
              sub(scale(add(base[0], base[1]), 0.5), c),
              0 + project.settings.northDeg,
            ),
          };
        })
        .map((v) => v as RoomView & { perimeter: number; midBearing: number });
      // Nummerierung je Richtung nach Winkel um den Schwerpunkt im Uhrzeigersinn ab Nord
      for (let sct = 0; sct < 8; sct++) {
        const same = (views as (RoomView & { midBearing: number })[])
          .filter((v) => v.sector === sct)
          .sort((a, b) => a.midBearing - b.midBearing);
        same.forEach((v, i) => {
          v.number = same.length > 1 ? i + 1 : null;
          v.name = `Wand ${directionName(sct)}${v.number ? ` ${v.number}` : ""}`;
        });
      }
      // Nachbarn: Umlauf gegen den Uhrzeigersinn; links vom Betrachter liegt der nächste Abschnitt
      const ring = (views as (RoomView & { perimeter: number })[])
        .filter((v) => !v.freeStanding)
        .sort((a, b) => a.perimeter - b.perimeter);
      ring.forEach((v, i) => {
        if (ring.length < 2) return;
        v.left = ring[(i + 1) % ring.length]!.key;
        v.right = ring[(i - 1 + ring.length) % ring.length]!.key;
      });
      const clean = views.map((v) => {
        const {
          perimeter: _p,
          midBearing: _m,
          ...rest
        } = v as RoomView & { perimeter: number; midBearing: number };
        void _p;
        void _m;
        return rest as RoomView;
      });
      clean.sort((a, b) => a.sector - b.sector || (a.number ?? 0) - (b.number ?? 0));
      result.set(room.id, clean);
    }
  }
  return result;
}

/** Wandseite ohne angrenzenden Raum („Flächen ohne Raum“). */
export interface FreeSurface {
  ref: string;
  wallId: string;
  storeyId: string;
  name: string;
  sector: number;
  /** Außenseite einer Außenwand */
  outside: boolean;
  side: WallSide;
  openings: ViewOpening[];
}

/** Wandseiten ohne Raum eines Geschosses in Baumreihenfolge (Richtung, dann Wand-ID). */
export function freeSurfaces(project: Project, storeyId: string): FreeSurface[] {
  const sides = wallSides(project, storeyId);
  const secs = sections(project, storeyId, sides);
  const used = new Set(secs.map((s) => s.ref));
  const list = sides
    .filter((s) => !used.has(s.ref))
    .map((side) => {
      const outside = outsideSideOf(project, side.wallId, secs) === side.side;
      const sct = sector(bearing(side.outward, project.settings.northDeg));
      return {
        ref: side.ref,
        wallId: side.wallId,
        storeyId,
        name: outside ? `${directionName(sct)} außen` : `Wandseite ${directionName(sct)}`,
        sector: sct,
        outside,
        side,
        openings: viewOpenings(project, side, 0, 0, outside),
      };
    })
    .sort(
      (a, b) => a.sector - b.sector || (a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0),
    );
  // gleiche Namen nach Wand-ID durchnummerieren
  const counts = new Map<string, number>();
  for (const f of list) counts.set(f.name, (counts.get(f.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return list.map((f) => {
    if ((counts.get(f.name) ?? 0) < 2) return f;
    const n = (seen.get(f.name) ?? 0) + 1;
    seen.set(f.name, n);
    return { ...f, name: `${f.name} ${n}` };
  });
}

/** Fläche des Modells mit SurfaceRef, Kontur in (u, v) und Transformation in die Welt (z ab OK Rohfußboden). */
export interface Surface {
  ref: string;
  kind: "wall-side" | "ceiling" | "floor" | "slope";
  storeyId: string;
  roomId?: string;
  contour: { u: number; v: number }[];
  toWorld(u: number, v: number): { x: number; y: number; z: number };
}

/**
 * Alle Flächen: je Wand beide Seiten über die ganze Länge (Kontur roh, v ab Rohfußboden), je Raum Decke,
 * Boden und jede gültige Schräge. Die Identität einer Wandseite hängt nur von Wand und Seite ab.
 */
export function deriveSurfaces(project: Project): Surface[] {
  const result: Surface[] = [];
  for (const storey of project.storeys) {
    for (const side of wallSides(project, storey.id)) {
      result.push({
        ref: side.ref,
        kind: "wall-side",
        storeyId: storey.id,
        contour: [
          { u: side.uMin, v: 0 },
          { u: side.uMax, v: 0 },
          { u: side.uMax, v: side.wallHeightMm },
          { u: side.uMin, v: side.wallHeightMm },
        ],
        toWorld: (u, v) => ({ ...sidePoint(side, u), z: v }),
      });
    }
    for (const room of project.rooms.filter(
      (r) => r.storeyId === storey.id && r.polygon.length >= 3,
    )) {
      const h = roomHeights(room, storey);
      result.push({
        ref: `floor:${room.id}`,
        kind: "floor",
        storeyId: storey.id,
        roomId: room.id,
        contour: room.polygon.map((p) => ({ u: p.x, v: p.y })),
        toWorld: (u, v) => ({ x: u, y: v, z: h.floorBuildupMm }),
      });
      result.push({
        ref: `ceiling:${room.id}`,
        kind: "ceiling",
        storeyId: storey.id,
        roomId: room.id,
        contour: room.polygon.map((p) => ({ u: -p.x, v: p.y })),
        toWorld: (u, v) => ({
          x: -u,
          y: v,
          z: rawCeilingAt(room, storey, { x: -u, y: v }) - h.plasterMm,
        }),
      });
      for (const slope of room.slopes ?? []) {
        if (!isSlopeValid(slope, room.polygon)) continue;
        const frame = slopeFrame(room, slope);
        result.push({
          ref: `slope:${room.id}:${slope.id}`,
          kind: "slope",
          storeyId: storey.id,
          roomId: room.id,
          contour: slopeOutline(room, storey, slope).map((p) => frame.toUV(p)),
          toWorld: (u, v) => {
            const p = frame.toPlan(u, v);
            return { ...p, z: slope.heightAtBaseMm + frame.d(p) * Math.tan(toRad(slope.angleDeg)) };
          },
        });
      }
    }
  }
  return result;
}

/** (u, v)-System einer Schräge: u entlang der Grundlinie ab ihrem linken Ende (Blick vom Raum), v die Schräge hinauf. */
export function slopeFrame(room: Room, slope: Slope) {
  const [a, b] = slope.baseLine;
  const along = normalize(sub(b, a));
  let m = perpLeft(along); // Normale zur Raumseite
  if (dot(sub(centroid(room.polygon), a), m) < 0) m = scale(m, -1);
  // Betrachter blickt vom Raum auf die Schräge (Richtung −m); rechts von ihm zeigt u
  const uDir = perpLeft(m);
  const left = dot(sub(a, b), uDir) < 0 ? a : b;
  const cos = Math.cos(toRad(slope.angleDeg));
  const d = (p: Vec) => dot(sub(p, a), m);
  return {
    uDir,
    m,
    d,
    toUV: (p: Vec) => ({ u: dot(sub(p, left), uDir), v: d(p) / cos }),
    toPlan: (u: number, v: number): Vec => add(add(left, scale(uDir, u)), scale(m, v * cos)),
  };
}

/** Grundriss des Bereichs, in dem diese Schräge die Decke bildet (Raumpolygon, beschnitten an Decke und anderen Schrägen). */
export function slopeOutline(room: Room, storey: Storey, slope: Slope): Vec[] {
  const frame = slopeFrame(room, slope);
  const h = roomHeights(room, storey);
  const tan = Math.tan(toRad(slope.angleDeg));
  const hs = (p: Vec) => slope.heightAtBaseMm + frame.d(p) * tan;
  // Halbebenen: h_s ≤ flache Decke und h_s ≤ jede andere gültige Schräge
  const constraints: ((p: Vec) => number)[] = [(p) => h.rawHeightMm - h.suspendedMm - hs(p)];
  for (const other of room.slopes ?? []) {
    if (other.id === slope.id || !isSlopeValid(other, room.polygon)) continue;
    const of = slopeFrame(room, other);
    const ot = Math.tan(toRad(other.angleDeg));
    constraints.push((p) => other.heightAtBaseMm + of.d(p) * ot - hs(p));
  }
  let poly: Vec[] = [...room.polygon];
  for (const g of constraints) poly = clipHalfPlane(poly, g);
  return poly;
}

/** Sutherland-Hodgman an einer linearen Funktion: behält g(p) ≥ 0. */
function clipHalfPlane(poly: Vec[], g: (p: Vec) => number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const gp = g(p);
    const gq = g(q);
    if (gp >= 0) out.push(p);
    if (gp >= 0 !== gq >= 0) {
      const t = gp / (gp - gq);
      out.push(add(p, scale(sub(q, p), t)));
    }
  }
  return out;
}
