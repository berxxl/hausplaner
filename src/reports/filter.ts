/**
 * Zeilenmodell, Filter und Sortierung der Listen (design.md M5 „Listen in der App“). Dieselben
 * Zeilen nutzt der PDF-Export. Frei von React.
 */
import type { Status, Trade } from "../model/types";

export interface Cell {
  text: string;
  /** Sortierschlüssel; null = leer (steht immer am Ende) */
  sort: string | number | null;
}

/** Was ein Zeilenklick auswählt. */
export type RowSelect =
  | { kind: "device"; id: string }
  | { kind: "circuit"; id: string }
  | { kind: "cable"; id: string }
  | { kind: "route-segment"; id: string };

export interface Row<C extends string = string> {
  id: string;
  select?: RowSelect;
  /** Geschosse und Räume der Zeile (Leitungen: beide Endpunkte); undefined = Filter gilt nicht */
  storeyIds?: string[];
  roomIds?: string[];
  trade?: Trade;
  status?: Status;
  cells: Record<C, Cell>;
}

export interface Column<C extends string = string> {
  key: C;
  label: string;
  /** rechtsbündig (Zahlen) */
  numeric?: boolean;
}

export interface RowFilter {
  storeyId?: string | null;
  roomId?: string | null;
  /** leer oder undefined = alle */
  trades?: readonly Trade[];
  statuses?: readonly Status[];
}

export const text = (t: string | null | undefined): Cell =>
  t === null || t === undefined || t === "" ? { text: "", sort: null } : { text: t, sort: t };

export const num = (n: number | null | undefined, shown?: string): Cell =>
  n === null || n === undefined
    ? { text: shown ?? "", sort: null }
    : { text: shown ?? String(n), sort: n };

/**
 * Filter (design.md M5 „Filter“): Ein Feld `undefined` heißt „Filter gilt für diese Liste nicht“,
 * eine leere Liste „kein Geschoss/Raum“ (wird bei gesetztem Filter ausgeschlossen).
 */
export function filterRows<R extends Row>(rows: readonly R[], f: RowFilter): R[] {
  return rows.filter((r) => {
    if (f.storeyId && r.storeyIds && !r.storeyIds.includes(f.storeyId)) return false;
    if (f.roomId && r.roomIds && !r.roomIds.includes(f.roomId)) return false;
    if (f.trades && f.trades.length > 0 && r.trade && !f.trades.includes(r.trade)) return false;
    if (f.statuses && f.statuses.length > 0 && r.status && !f.statuses.includes(r.status))
      return false;
    return true;
  });
}

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

export function compareCells(a: Cell, b: Cell): number {
  if (a.sort === null || b.sort === null) return a.sort === b.sort ? 0 : a.sort === null ? 1 : -1;
  if (typeof a.sort === "number" && typeof b.sort === "number") return a.sort - b.sort;
  return collator.compare(String(a.sort), String(b.sort));
}

/** Sortiert stabil nach einer Spalte; leere Werte stehen auch absteigend am Ende. */
export function sortRows<R extends Row>(rows: readonly R[], key: string, desc = false): R[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = x.r.cells[key]!;
      const b = y.r.cells[key]!;
      if (a.sort === null || b.sort === null) return compareCells(a, b) || x.i - y.i;
      return (desc ? -compareCells(a, b) : compareCells(a, b)) || x.i - y.i;
    })
    .map((x) => x.r);
}

/** Sortiert nach mehreren Spalten aufsteigend (Standardsortierung einer Liste). */
export function sortBy<R extends Row>(rows: readonly R[], keys: readonly string[]): R[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      for (const k of keys) {
        const c = compareCells(x.r.cells[k]!, y.r.cells[k]!);
        if (c !== 0) return c;
      }
      return x.i - y.i;
    })
    .map((x) => x.r);
}

export function formatMeters(mm: number): string {
  return (mm / 1000).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
