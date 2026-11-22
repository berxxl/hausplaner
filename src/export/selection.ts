/**
 * Auswahl im Exportdialog → Blattliste in der festgelegten Reihenfolge (design.md M5 „Exportdialog“).
 * Frei von React.
 */
import { deriveRoomViews, freeSurfaces } from "../geometry/surfaces";
import type { Project } from "../model/types";
import { LISTS, type ListKind } from "../reports/lists";
import type { SurfaceTarget } from "../store/view";
import { boardSheets } from "./board";
import type { ExportOptions, SheetResult } from "./compose";
import { planSheet } from "./plan";
import { surfaceSheet } from "./surface";
import { listSheets } from "./table";

export interface ExportSelection {
  /** Grundrisse je Geschoss */
  plans: string[];
  /** Räume mit allen Wandansichten, Decke, Boden, Schrägen */
  walls: string[];
  ceilings: string[];
  floors: string[];
  slopes: string[];
  /** Geschosse, deren „Flächen ohne Raum“ exportiert werden */
  freeSurfaces: string[];
  boards: string[];
  lists: ListKind[];
}

export const EMPTY_SELECTION: ExportSelection = {
  plans: [],
  walls: [],
  ceilings: [],
  floors: [],
  slopes: [],
  freeSurfaces: [],
  boards: [],
  lists: [],
};

export const sortedStoreys = (project: Project) =>
  [...project.storeys].sort((a, b) => a.elevationMm - b.elevationMm);

export const sortedRooms = (project: Project, storeyId: string) =>
  project.rooms
    .filter((r) => r.storeyId === storeyId)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

/** Verteiler in Baumreihenfolge: Hierarchie, Geschwister nach Bezeichnung. */
export function boardOrder(project: Project): string[] {
  const byLabel = (a: { label: string }, b: { label: string }) =>
    a.label.localeCompare(b.label, "de", { numeric: true });
  const ids = new Set(project.boards.map((b) => b.id));
  const out: string[] = [];
  const visit = (parent: string | undefined) => {
    for (const b of project.boards
      .filter((x) =>
        parent === undefined
          ? !x.parentBoardId || !ids.has(x.parentBoardId)
          : x.parentBoardId === parent,
      )
      .sort(byLabel)) {
      if (out.includes(b.id)) continue;
      out.push(b.id);
      visit(b.id);
    }
  };
  visit(undefined);
  return out;
}

/** Geschoss an- oder abwählen: Grundriss, alle Räume (Wände, Decke, Boden, Schrägen), Flächen ohne Raum. */
export function setStorey(
  project: Project,
  sel: ExportSelection,
  storeyId: string,
  on: boolean,
): ExportSelection {
  const rooms = sortedRooms(project, storeyId).map((r) => r.id);
  const withSlopes = sortedRooms(project, storeyId)
    .filter((r) => (r.slopes ?? []).length > 0)
    .map((r) => r.id);
  const set = (xs: string[], add: string[]) =>
    on ? [...new Set([...xs, ...add])] : xs.filter((x) => !add.includes(x));
  return {
    ...sel,
    plans: set(sel.plans, [storeyId]),
    walls: set(sel.walls, rooms),
    ceilings: set(sel.ceilings, rooms),
    floors: set(sel.floors, rooms),
    slopes: set(sel.slopes, withSlopes),
    freeSurfaces: set(sel.freeSurfaces, [storeyId]),
  };
}

/** Flächenziele in Blattreihenfolge (ohne Grundrisse, Belegungen, Listen). */
export function surfaceTargets(project: Project, sel: ExportSelection): SurfaceTarget[] {
  const views = deriveRoomViews(project);
  const out: SurfaceTarget[] = [];
  for (const storey of sortedStoreys(project)) {
    for (const room of sortedRooms(project, storey.id)) {
      if (sel.walls.includes(room.id))
        for (const v of views.get(room.id) ?? []) out.push({ kind: "room-wall", key: v.key });
      if (sel.ceilings.includes(room.id)) out.push({ kind: "ceiling", roomId: room.id });
      if (sel.floors.includes(room.id)) out.push({ kind: "floor", roomId: room.id });
      if (sel.slopes.includes(room.id))
        for (const sl of room.slopes ?? [])
          out.push({ kind: "slope", roomId: room.id, slopeId: sl.id });
    }
  }
  for (const storey of sortedStoreys(project))
    if (sel.freeSurfaces.includes(storey.id))
      for (const f of freeSurfaces(project, storey.id)) out.push({ kind: "wall-side", ref: f.ref });
  return out;
}

/** Alle Blätter der Auswahl: Grundrisse, Flächen, Belegungen, Listen. */
export function buildSheets(
  project: Project,
  sel: ExportSelection,
  o: ExportOptions,
): SheetResult[] {
  const out: SheetResult[] = [];
  for (const storey of sortedStoreys(project))
    if (sel.plans.includes(storey.id)) {
      const r = planSheet(project, storey.id, o);
      if (r) out.push(r);
    }
  for (const t of surfaceTargets(project, sel)) {
    const r = surfaceSheet(project, t, o);
    if (r) out.push(r);
  }
  for (const id of boardOrder(project))
    if (sel.boards.includes(id)) out.push(...boardSheets(project, id, o));
  for (const l of LISTS)
    if (sel.lists.includes(l.kind)) out.push(...listSheets(project, l.kind, o));
  return out;
}

export const selectionCount = (sel: ExportSelection) =>
  sel.plans.length +
  sel.walls.length +
  sel.ceilings.length +
  sel.floors.length +
  sel.slopes.length +
  sel.freeSurfaces.length +
  sel.boards.length +
  sel.lists.length;
