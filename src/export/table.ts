/**
 * Listen als Tabellenblätter (design.md M5 „Planinhalte“, Listen): Spaltenbreiten nach Inhalt,
 * Kürzen mit „…“, Kopfzeile je Seite, Summen am Ende, Seitenzahl im Plankopf. Frei von React.
 */
import type { Project } from "../model/types";
import { filterRows, type Column, type Row } from "../reports/filter";
import { LISTS, type ListKind } from "../reports/lists";
import { materialList } from "../reports/material";
import {
  CABLE_COLUMNS,
  cableRows,
  cableTotals,
  cableTotalText,
  CIRCUIT_COLUMNS,
  circuitRows,
  DEVICE_COLUMNS,
  deviceRows,
  KNX_COLUMNS,
  knxRows,
  knxSummary,
  PENETRATION_COLUMNS,
  penetrationRows,
} from "../reports/rows";
import { composeSheet, type ContentFilter, type ExportOptions, type SheetResult } from "./compose";
import {
  drawingArea,
  LINE,
  pdfText,
  TEXT,
  textWidth,
  type Item,
  type Rect,
  type Sheet,
} from "./sheet";

export interface TableBlock {
  title?: string;
  columns: readonly Column[];
  rows: readonly Row[];
  summary: readonly string[];
}

const ROW_H = 4.5;
const TITLE_H = 7;
const PAD = 2;
const SIZE = TEXT.normal;

/** Text auf eine Breite kürzen (geschätzte Zeichenbreite). */
export function fitText(s: string, widthMm: number, size: number = SIZE): string {
  const max = Math.floor(widthMm / (size * 0.5));
  if (s.length <= max) return s;
  return max <= 1 ? "…" : `${s.slice(0, max - 1)}…`;
}

/** Spaltenbreiten proportional zur längsten Zelle, mindestens die Kopfbreite, gesamt ≤ Breite. */
export function columnWidths(block: TableBlock, width: number): number[] {
  const head = block.columns.map((c) => textWidth(c.label, SIZE) + PAD);
  const want = block.columns.map((c, i) =>
    Math.max(head[i]!, ...block.rows.map((r) => textWidth(r.cells[c.key]?.text ?? "", SIZE) + PAD)),
  );
  const total = want.reduce((a, b) => a + b, 0);
  if (total <= width) return want;
  // Überschuss auf die Spalten verteilen, die breiter als ihr Kopf sind
  const minTotal = head.reduce((a, b) => a + b, 0);
  if (minTotal >= width) return head.map((h) => (h * width) / minTotal);
  const flex = want.map((w, i) => w - head[i]!);
  const flexTotal = flex.reduce((a, b) => a + b, 0);
  const k = (width - minTotal) / flexTotal;
  return head.map((h, i) => h + flex[i]! * k);
}

/** Verteilt Tabellenblöcke auf Seiten; die erste Seite darf erst bei `firstY` beginnen. */
export function layoutTables(blocks: readonly TableBlock[], area: Rect, firstY = area.y): Item[][] {
  const pages: Item[][] = [[]];
  let y = firstY;
  const page = () => pages.at(-1)!;
  const newPage = () => {
    pages.push([]);
    y = area.y;
  };
  for (const block of blocks) {
    const widths = columnWidths(block, area.width);
    const xs = widths.map((_, i) => area.x + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const header = () => {
      block.columns.forEach((c, i) => {
        page().push({
          kind: "text",
          x: c.numeric ? xs[i]! + widths[i]! - PAD / 2 : xs[i]!,
          y: y + 3.2,
          text: pdfText(fitText(c.label, widths[i]! - PAD / 2)),
          size: SIZE,
          bold: true,
          anchor: c.numeric ? "end" : "start",
        });
      });
      page().push({
        kind: "line",
        x1: area.x,
        y1: y + ROW_H,
        x2: area.x + area.width,
        y2: y + ROW_H,
        width: LINE.edge,
      });
      y += ROW_H + 0.5;
    };
    if (y + (block.title ? TITLE_H : 0) + 2 * ROW_H > area.y + area.height) newPage();
    if (block.title) {
      page().push({
        kind: "text",
        x: area.x,
        y: y + 4.5,
        text: pdfText(block.title),
        size: TEXT.room,
        bold: true,
        data: `block:${block.title}`,
      });
      y += TITLE_H;
    }
    header();
    if (block.rows.length === 0) {
      page().push({ kind: "text", x: area.x, y: y + 3.2, text: "Keine Einträge", size: SIZE });
      y += ROW_H;
    }
    for (const r of block.rows) {
      if (y + ROW_H > area.y + area.height) {
        newPage();
        header();
      }
      block.columns.forEach((c, i) => {
        const t = r.cells[c.key]?.text ?? "";
        if (!t) return;
        page().push({
          kind: "text",
          x: c.numeric ? xs[i]! + widths[i]! - PAD / 2 : xs[i]!,
          y: y + 3.2,
          text: pdfText(fitText(t, widths[i]! - PAD / 2)),
          size: SIZE,
          anchor: c.numeric ? "end" : "start",
          data: i === 0 ? `row:${r.id}` : undefined,
        });
      });
      page().push({
        kind: "line",
        x1: area.x,
        y1: y + ROW_H,
        x2: area.x + area.width,
        y2: y + ROW_H,
        width: LINE.dimension,
        color: "#c7c7cc",
      });
      y += ROW_H;
    }
    for (const s of block.summary) {
      if (y + ROW_H > area.y + area.height) newPage();
      page().push({
        kind: "text",
        x: area.x,
        y: y + 3.6,
        text: pdfText(s),
        size: SIZE,
        bold: true,
        data: "summary",
      });
      y += ROW_H;
    }
    y += 4;
  }
  return pages;
}

/** Blöcke einer Liste mit den Filtern des Exports (alle Geschosse, Standardsortierung). */
export function listBlocks(project: Project, kind: ListKind, f: ContentFilter): TableBlock[] {
  const filter = { trades: f.trades, statuses: f.statuses };
  switch (kind) {
    case "devices":
      return [
        { columns: DEVICE_COLUMNS, rows: filterRows(deviceRows(project), filter), summary: [] },
      ];
    case "circuits":
      return [
        { columns: CIRCUIT_COLUMNS, rows: filterRows(circuitRows(project), filter), summary: [] },
      ];
    case "knx": {
      const rows = filterRows(knxRows(project), filter);
      return [{ columns: KNX_COLUMNS, rows, summary: rows.length > 0 ? [knxSummary(rows)] : [] }];
    }
    case "cables": {
      const rows = filterRows(cableRows(project), filter);
      return [
        { columns: CABLE_COLUMNS, rows, summary: cableTotals(project, rows).map(cableTotalText) },
      ];
    }
    case "penetrations":
      return [
        {
          columns: PENETRATION_COLUMNS,
          rows: filterRows(penetrationRows(project), filter),
          summary: [],
        },
      ];
    case "material":
      return materialList(project, filter).map((s) => ({
        title: s.title,
        columns: s.columns,
        rows: s.rows,
        summary: [],
      }));
  }
}

/** Seiten mit Plankopf; Seitenzahl „i/n“ wird nachgetragen. */
export function pagedSheets(
  o: ExportOptions,
  content: string,
  storey: string,
  pages: Item[][],
): Sheet[] {
  return pages.map((items, i) =>
    composeSheet(o, {
      content,
      storey,
      scale: null,
      items,
      legend: [],
      page: `${i + 1}/${pages.length}`,
    }),
  );
}

export function listSheets(project: Project, kind: ListKind, o: ExportOptions): SheetResult[] {
  const label = LISTS.find((l) => l.kind === kind)!.label;
  const content = `Liste ${label}`;
  const pages = layoutTables(listBlocks(project, kind, o), drawingArea(o.format));
  return pagedSheets(o, content, "", pages).map((sheet) => ({ sheet, content, fit: null }));
}
