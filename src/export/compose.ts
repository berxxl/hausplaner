/**
 * Gemeinsame Teile der Planblätter (design.md M5 „Planinhalte“, „Blattmodell“): Exportoptionen,
 * Gewerk- und Statusfilter, Planart, Zusammenbau eines Blatts. Frei von React.
 */
import { lineTypeTrade } from "../geometry/circuits";
import type { Device, Project, RouteSegment, Status, Trade } from "../model/types";
import { TRADES } from "../model/schema";
import { STATUS_LABELS, TRADE_LABELS } from "../ui/labels";
import { isAsBuilt } from "./settings";
import {
  drawingArea,
  legendEntries,
  legendItems,
  legendRect,
  LEGEND_STRIP_MM,
  paperSize,
  scaleBarItems,
  titleBlockItems,
  type Format,
  type Item,
  type LegendEntry,
  type Rect,
  type Sheet,
  type TitleBlock,
} from "./sheet";

export interface ExportOptions {
  format: Format;
  scale: number;
  project: string;
  /** „22.11.2026“ */
  date: string;
  planStatus: string;
  trades: readonly Trade[];
  statuses: readonly Status[];
}

export interface SheetResult {
  sheet: Sheet;
  /** Planinhalt, z. B. „Grundriss EG“ */
  content: string;
  /** null = nicht maßstäblich (passt immer) */
  fit: { ok: boolean; needed: number | null } | null;
}

export const planKind = (o: Pick<ExportOptions, "statuses">): TitleBlock["planKind"] =>
  isAsBuilt(o.statuses) ? "Bestandsplan" : "Planung";

export function filterText(o: Pick<ExportOptions, "trades" | "statuses">): string {
  const trades =
    o.trades.length === TRADES.length
      ? "alle Gewerke"
      : o.trades.length === 0
        ? "keine Gewerke"
        : TRADES.filter((t) => o.trades.includes(t))
            .map((t) => TRADE_LABELS[t])
            .join(", ");
  const all = o.statuses.length === 3;
  const statuses = (["planned", "installed", "verified"] as const)
    .filter((s) => o.statuses.includes(s))
    .map((s) => STATUS_LABELS[s])
    .join(", ");
  return all ? trades : `${trades} · ${statuses}`;
}

const typeOf = (project: Project, d: Device) =>
  project.catalog.deviceTypes.find((t) => t.id === d.typeId);

export type ContentFilter = Pick<ExportOptions, "trades" | "statuses">;

export function deviceVisible(project: Project, o: ContentFilter, d: Device): boolean {
  const trade = typeOf(project, d)?.trade ?? "other";
  return o.trades.includes(trade) && o.statuses.includes(d.status);
}

/** Segment: Status; Gewerk über die Leitungen darauf (ohne Leitung gewerkfrei). */
export function segmentVisible(project: Project, o: ContentFilter, s: RouteSegment): boolean {
  if (!o.statuses.includes(s.status)) return false;
  const trades = project.cables
    .filter((c) => c.path?.includes(s.id))
    .map((c) => lineTypeTrade(project, c))
    .filter((t): t is Trade => !!t);
  return trades.length === 0 || trades.some((t) => o.trades.includes(t));
}

/** Zeichenfläche eines Blatts mit Legende und ggf. Maßstabsleiste. */
export function contentArea(f: Format, scaled: boolean, hasLegend: boolean): Rect {
  return drawingArea(f, { scaleBar: scaled, legendStrip: hasLegend });
}

/** Blatt aus Inhalt, Plankopf, Legende und Maßstabsleiste. */
export function composeSheet(
  o: ExportOptions,
  parts: {
    content: string;
    storey: string;
    scale: number | null;
    items: Item[];
    legend: LegendEntry[];
    page?: string;
    format?: Format;
  },
): Sheet {
  const f = parts.format ?? o.format;
  const { widthMm, heightMm } = paperSize(f);
  const title: TitleBlock = {
    project: o.project,
    content: parts.content,
    storey: parts.storey,
    scale: parts.scale,
    date: o.date,
    planStatus: o.planStatus,
    planKind: planKind(o),
    filter: filterText(o),
    page: parts.page,
  };
  const items: Item[] = [...parts.items, ...titleBlockItems(f, title)];
  if (parts.legend.length > 0) {
    const r = legendRect(f);
    const area = drawingArea(f, { scaleBar: parts.scale !== null });
    const rect = r ?? {
      x: area.x,
      y: area.y + area.height - LEGEND_STRIP_MM + 2,
      width: area.width,
      height: LEGEND_STRIP_MM - 2,
    };
    items.push(...legendItems(parts.legend, rect));
  }
  if (parts.scale !== null) {
    const area = drawingArea(f, { scaleBar: true });
    items.push(...scaleBarItems(parts.scale, area.x, area.y + area.height + 4));
  }
  return { widthMm, heightMm, title, items };
}

export { legendEntries };

/** Dateiname aus Projekt, optional Planinhalt, und Datum; nur Buchstaben, Ziffern, Leerzeichen, „-“, „_“. */
export function pdfFileName(project: string, date: string, content?: string): string {
  const clean = (s: string) =>
    s
      .replace(/[^\p{L}\p{N} _-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  return `${[clean(project), content ? clean(content) : null, clean(date)].filter(Boolean).join(" ")}.pdf`;
}
