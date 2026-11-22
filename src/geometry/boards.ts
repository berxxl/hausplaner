/**
 * Verteiler (design.md M4 „Verteiler platzieren“, „Belegungsansicht“): Lage, Gerätebreite,
 * Belegung je Reihe, Platzprüfung, Platzsuche. Die Reserve mit vorgemerktem Bedarf steht in
 * `geometry/reserve.ts`. Frei von React.
 */
import { placementWorld } from "./devices";
import { wallSides } from "./surfaces";
import { add, scale, type Vec } from "./vec";
import type {
  Board,
  BoardField,
  BoardPlacement,
  Device,
  DeviceType,
  Project,
  Trade,
} from "../model/types";

/** Breite einer Teilungseinheit in mm. */
export const TE_MM = 18;

/** Gewerke, die ein Verteiler je Art als Leitungsendpunkt anschließt (design.md M4). */
const BOARD_CONNECTS: Record<Board["kind"], readonly Trade[]> = {
  "meter-cabinet": ["power", "knx", "conduit", "other"],
  "sub-distribution": ["power", "knx", "conduit", "other"],
  media: ["data", "power", "conduit", "other"],
};

export function boardConnects(kind: Board["kind"]): readonly Trade[] {
  return BOARD_CONNECTS[kind];
}

export const BOARD_KIND_LABELS: Record<Board["kind"], string> = {
  "meter-cabinet": "Zählerschrank",
  "sub-distribution": "Unterverteilung",
  media: "Medienverteiler",
};

export const FIELD_KIND_LABELS: Record<BoardField["kind"], string> = {
  meter: "Zählerfeld",
  apz: "APZ-Feld",
  "upper-connection": "Oberer Anschlussraum",
  "lower-connection": "Unterer Anschlussraum",
  distribution: "Verteilerfeld",
  multimedia: "Multimediafeld",
};

/** Standardwerte je Art (design.md M4 „Verteiler platzieren“); Felder ohne IDs. */
export const BOARD_DEFAULTS: Record<
  Board["kind"],
  {
    label: (storeyName: string) => string;
    size: [number, number, number];
    mounting: Board["mounting"];
    fields: Omit<BoardField, "id">[];
  }
> = {
  "meter-cabinet": {
    label: () => "Zählerschrank",
    size: [800, 1100, 210],
    mounting: "surface",
    fields: [
      { kind: "meter", rows: 0, tePerRow: 0 },
      { kind: "apz", rows: 1, tePerRow: 12 },
      { kind: "distribution", rows: 4, tePerRow: 12 },
    ],
  },
  "sub-distribution": {
    label: (storey) => `UV ${storey}`,
    size: [550, 1100, 120],
    mounting: "flush",
    fields: [{ kind: "distribution", rows: 4, tePerRow: 12 }],
  },
  media: {
    label: () => "Medienverteiler",
    size: [550, 650, 120],
    mounting: "flush",
    fields: [{ kind: "multimedia", rows: 2, tePerRow: 12 }],
  },
};

export interface BoardWorld {
  /** Mitte der Vorderseite auf der fertigen Wandoberfläche, z über Rohfußboden */
  x: number;
  y: number;
  z: number;
  /** Richtung in den Raum */
  normal: Vec;
  /** Richtung von u auf der Wandseite */
  uDir: Vec;
}

/** Weltlage eines Verteilers; null ohne Wandseite. */
export function boardWorld(project: Project, board: Board): BoardWorld | null {
  const { surface, u, v } = board.placement;
  const w = placementWorld(project, board.storeyId, {
    kind: "surface",
    surface,
    u,
    v,
    rotationDeg: 0,
  });
  const side = wallSides(project, board.storeyId).find((s) => s.ref === surface);
  if (!w || !side) return null;
  return { x: w.x, y: w.y, z: w.z, normal: { x: w.normal.x, y: w.normal.y }, uDir: side.uDir };
}

/** Grundrissrechteck Breite × Tiefe: Unterputz in die Wand hinein, Aufputz in den Raum. */
export function boardPlanRect(project: Project, board: Board): Vec[] | null {
  const w = boardWorld(project, board);
  if (!w) return null;
  const c = { x: w.x, y: w.y };
  const half = scale(w.uDir, board.widthMm / 2);
  const depth = scale(w.normal, board.mounting === "flush" ? -board.depthMm : board.depthMm);
  const a = add(c, scale(half, -1));
  const b = add(c, half);
  return [a, b, add(b, depth), add(a, depth)];
}

/** Rechteck der Vorderseite in (u, v) der Wandseite. */
export function boardFrontRect(board: Board) {
  const { u, v } = board.placement;
  return {
    uFrom: u - board.widthMm / 2,
    uTo: u + board.widthMm / 2,
    vFrom: v - board.heightMm / 2,
    vTo: v + board.heightMm / 2,
  };
}

/** Anker des Verteilerknotens: Mitte der Oberkante (design.md M4 „Verteiler als Endpunkt“). */
export function boardNodeAnchor(board: Board) {
  return {
    surface: board.placement.surface,
    u: board.placement.u,
    v: Math.round(board.placement.v + board.heightMm / 2),
  };
}

/** Breite in TE: `teWidth` aufgerundet, sonst aus der Breite der 3D-Form. */
export function deviceTeWidth(type: DeviceType | undefined): number {
  if (!type) return 1;
  if (type.teWidth !== undefined) return Math.max(1, Math.ceil(type.teWidth));
  return Math.max(1, Math.ceil(type.shape3d.widthMm / TE_MM));
}

/** Felder mit Reihen für Reiheneinbaugeräte. */
export const fieldHasRows = (f: BoardField) => f.rows > 0 && f.tePerRow > 0;

/** Darf ein Typ in ein Feld dieser Art? Hutschiene überall, im Multimediafeld auch Datengeräte. */
export function fieldAccepts(type: DeviceType, kind: BoardField["kind"]): boolean {
  if (type.mounting.includes("din-rail")) return true;
  return kind === "multimedia" && type.trade === "data";
}

/** Alle Typen, die in irgendein Feld des Verteilers passen (Palette). */
export function placeableBoardTypes(project: Project, board: Board): DeviceType[] {
  const kinds = board.fields.filter(fieldHasRows).map((f) => f.kind);
  return project.catalog.deviceTypes.filter((t) => kinds.some((k) => fieldAccepts(t, k)));
}

export const boardDevices = (project: Project, boardId: string): Device[] =>
  project.devices.filter((d) => d.placement.kind === "board" && d.placement.boardId === boardId);

export const typeOf = (project: Project, device: Device) =>
  project.catalog.deviceTypes.find((t) => t.id === device.typeId);

export interface RowItem {
  deviceId: string;
  /** erster und letzter belegter Platz (ab 1) */
  from: number;
  to: number;
}

/** Belegung einer Reihe, nach Platz sortiert. */
export function rowItems(
  project: Project,
  boardId: string,
  fieldId: string,
  row: number,
): RowItem[] {
  return boardDevices(project, boardId)
    .filter((d) => {
      const p = d.placement as BoardPlacement;
      return p.fieldId === fieldId && p.row === row;
    })
    .map((d) => {
      const p = d.placement as BoardPlacement;
      return { deviceId: d.id, from: p.slot, to: p.slot + deviceTeWidth(typeOf(project, d)) - 1 };
    })
    .sort((a, b) => a.from - b.from || (a.deviceId < b.deviceId ? -1 : 1));
}

/** Freie TE ab einem Platz bis zum nächsten Gerät oder Reihenende. */
export function freeFrom(items: readonly RowItem[], tePerRow: number, slot: number): number {
  if (items.some((i) => i.from <= slot && i.to >= slot)) return 0;
  const next = items.filter((i) => i.from > slot).map((i) => i.from);
  const end = next.length > 0 ? Math.min(...next) - 1 : tePerRow;
  return Math.max(0, end - slot + 1);
}

export interface Placement {
  fieldId: string;
  row: number;
  slot: number;
}

/**
 * Prüft, ob ein Gerät des Typs an diese Stelle passt (design.md M4 „Prüfung beim Einsetzen“);
 * `ignore` ist das Gerät, das gerade umgesetzt wird. Liefert die Meldung oder null.
 */
export function fitError(
  project: Project,
  board: Board,
  type: DeviceType,
  at: Placement,
  ignore?: string,
): string | null {
  const field = board.fields.find((f) => f.id === at.fieldId);
  if (!field || !fieldHasRows(field) || at.row < 1 || at.row > field.rows || at.slot < 1)
    return "Kein Platz an dieser Stelle";
  if (!fieldAccepts(type, field.kind))
    return `${type.name} passt nicht in ein ${FIELD_KIND_LABELS[field.kind]}`;
  const width = deviceTeWidth(type);
  const items = rowItems(project, board.id, field.id, at.row).filter((i) => i.deviceId !== ignore);
  const free = at.slot > field.tePerRow ? 0 : freeFrom(items, field.tePerRow, at.slot);
  if (free < width)
    return `Kein Platz: In Reihe ${at.row} sind ab Platz ${at.slot} nur ${free} TE frei`;
  return null;
}

/**
 * Erster freier Bereich für `width` TE in den Verteilerfeldern (Feldreihenfolge, Reihen von oben,
 * Plätze von links); `taken` sind zusätzlich belegte Bereiche (z. B. schon eingeplante Aktoren).
 */
export function findFreeSlot(
  project: Project,
  board: Board,
  width: number,
  taken: readonly (Placement & { width: number })[] = [],
): Placement | null {
  for (const field of board.fields) {
    if (field.kind !== "distribution" || !fieldHasRows(field)) continue;
    for (let row = 1; row <= field.rows; row++) {
      const items: RowItem[] = [
        ...rowItems(project, board.id, field.id, row),
        ...taken
          .filter((t) => t.fieldId === field.id && t.row === row)
          .map((t) => ({ deviceId: "", from: t.slot, to: t.slot + t.width - 1 })),
      ];
      for (let slot = 1; slot + width - 1 <= field.tePerRow; slot++)
        if (freeFrom(items, field.tePerRow, slot) >= width) return { fieldId: field.id, row, slot };
    }
  }
  return null;
}

/** Summe der TE aller Verteilerfelder und der Gerätebreiten darin (für die Reserve). */
export function distributionTe(project: Project, board: Board): { total: number; used: number } {
  const fields = board.fields.filter((f) => f.kind === "distribution");
  const total = fields.reduce((s, f) => s + f.rows * f.tePerRow, 0);
  const ids = new Set(fields.map((f) => f.id));
  const used = boardDevices(project, board.id)
    .filter((d) => ids.has((d.placement as BoardPlacement).fieldId))
    .reduce((s, d) => s + deviceTeWidth(typeOf(project, d)), 0);
  return { total, used };
}

/** Geräte, die nicht mehr in ihre Reihe passen bzw. andere überlappen (Warnungen). */
export function boardLayoutIssues(project: Project, board: Board) {
  const outside: string[] = [];
  const overlap: string[] = [];
  for (const field of board.fields) {
    const devs = boardDevices(project, board.id).filter(
      (d) => (d.placement as BoardPlacement).fieldId === field.id,
    );
    const rows = new Set(devs.map((d) => (d.placement as BoardPlacement).row));
    for (const row of rows) {
      const items = rowItems(project, board.id, field.id, row);
      for (const i of items)
        if (row > field.rows || i.to > field.tePerRow || !fieldHasRows(field))
          outside.push(i.deviceId);
      // an jedem Gerät außer dem mit der kleinsten ID einer überlappenden Gruppe
      for (const i of items) {
        const others = items.filter((o) => o !== i && o.from <= i.to && o.to >= i.from);
        if (others.length > 0 && others.some((o) => o.deviceId < i.deviceId))
          overlap.push(i.deviceId);
      }
    }
  }
  return { outside, overlap };
}

/** Nachkommen eines Verteilers über parentBoardId (ohne ihn selbst). */
export function boardDescendants(project: Project, boardId: string): Set<string> {
  const out = new Set<string>();
  const stack = [boardId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const b of project.boards)
      if (b.parentBoardId === id && !out.has(b.id) && b.id !== boardId) {
        out.add(b.id);
        stack.push(b.id);
      }
  }
  return out;
}

/** Patchfeldports eines Medienverteilers: Leitungen des Gewerks Daten mit ihm als Endpunkt. */
export function patchPorts(project: Project, boardId: string): number {
  const data = new Set(
    project.catalog.lineTypes.filter((t) => t.trade === "data").map((t) => t.id),
  );
  return project.cables.filter(
    (c) => data.has(c.lineTypeId) && (c.from.boardId === boardId || c.to.boardId === boardId),
  ).length;
}
