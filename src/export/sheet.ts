/**
 * Blattmodell für den PDF-Export (design.md M5 „Blattmodell“): Formate, Zeichenfläche, Plankopf,
 * Legende, Maßstabsleiste, Passprüfung, Text für WinAnsi. Papiermillimeter, Ursprung oben links,
 * y nach unten. Frei von React.
 */
import type { DeviceType } from "../model/types";
import type { ExportSettings } from "./settings";

export type Paper = ExportSettings["paper"];
export type Orientation = ExportSettings["orientation"];

export interface Format {
  paper: Paper;
  orientation: Orientation;
}

interface Style {
  width?: number;
  color?: string;
  dash?: number[];
  data?: string;
}

export type Item =
  | ({ kind: "line"; x1: number; y1: number; x2: number; y2: number } & Style)
  | ({
      kind: "poly";
      points: [number, number][];
      closed: boolean;
      fill?: string;
      /** null = keine Kontur */
      stroke?: string | null;
    } & Style)
  | ({
      kind: "path";
      /** mehrere Ringe; Löcher gegenläufig (Füllregel nonzero) */
      rings: [number, number][][];
      fill?: string;
      stroke?: string | null;
    } & Style)
  | ({
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string | null;
    } & Style)
  | ({
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      anchor?: "start" | "middle" | "end";
      rotate?: number;
      bold?: boolean;
    } & Style)
  | ({ kind: "symbol"; svg: string; x: number; y: number; size: number; rotate?: number } & Style);

export interface TitleBlock {
  project: string;
  content: string;
  storey: string;
  /** null = nicht maßstäblich („ohne“) */
  scale: number | null;
  date: string;
  planStatus: string;
  planKind: "Bestandsplan" | "Planung";
  filter: string;
  page?: string;
}

export interface Sheet {
  widthMm: number;
  heightMm: number;
  title: TitleBlock;
  items: Item[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Maße (design.md M5 „Blattmodell“) ---

export const MARGIN_MM = 10;
export const BINDING_MARGIN_MM = 20;
export const TITLE_W_MM = 180;
export const TITLE_H_MM = 36;
export const BAND_H_MM = 40;
export const SCALE_BAR_H_MM = 10;
export const LEGEND_COL_MM = 45;
export const LEGEND_STRIP_MM = 20;

export const TEXT = { normal: 2.5, room: 3.5, small: 1.8, title: 5 } as const;
export const LINE = {
  wallOutline: 0.35,
  edge: 0.25,
  opening: 0.18,
  route: 0.35,
  dimension: 0.13,
  gridFine: 0.1,
  gridBold: 0.25,
} as const;
export const COLOR = {
  wall: "#404040",
  text: "#000000",
  muted: "#6e6e73",
  gridFine: "#c0c0c0",
  gridBold: "#909090",
} as const;

const SIZES: Record<Paper, [number, number]> = { A4: [210, 297], A3: [297, 420] };

export function paperSize(f: Format): { widthMm: number; heightMm: number } {
  const [a, b] = SIZES[f.paper];
  return f.orientation === "portrait" ? { widthMm: a, heightMm: b } : { widthMm: b, heightMm: a };
}

export function formatLabel(f: Format): string {
  return `${f.paper} ${f.orientation === "portrait" ? "hoch" : "quer"}`;
}

/** Linker Rand: A4 mit Heftrand. */
const leftMargin = (f: Format) => (f.paper === "A4" ? BINDING_MARGIN_MM : MARGIN_MM);

/** Plankopf unten rechts. */
export function titleRect(f: Format): Rect {
  const { widthMm, heightMm } = paperSize(f);
  return {
    x: widthMm - MARGIN_MM - TITLE_W_MM,
    y: heightMm - MARGIN_MM - TITLE_H_MM,
    width: TITLE_W_MM,
    height: TITLE_H_MM,
  };
}

/** Platz für die Legende links neben dem Plankopf; null, wenn dort kein Platz ist (A4 hoch). */
export function legendRect(f: Format): Rect | null {
  const t = titleRect(f);
  const x = leftMargin(f);
  const width = t.x - 5 - x;
  return width >= LEGEND_COL_MM ? { x, y: t.y, width, height: TITLE_H_MM } : null;
}

/**
 * Zeichenfläche: Blatt ohne Rand und ohne den unteren Streifen. `scaleBar` reserviert unten Platz
 * für die Maßstabsleiste, `legendStrip` (A4 hoch) einen Streifen für die Legende.
 */
export function drawingArea(
  f: Format,
  opts: { scaleBar?: boolean; legendStrip?: boolean } = {},
): Rect {
  const { widthMm, heightMm } = paperSize(f);
  const x = leftMargin(f);
  const y = MARGIN_MM;
  let height = heightMm - MARGIN_MM - BAND_H_MM - y;
  if (opts.scaleBar) height -= SCALE_BAR_H_MM;
  if (opts.legendStrip && !legendRect(f)) height -= LEGEND_STRIP_MM;
  return { x, y, width: widthMm - MARGIN_MM - x, height };
}

// --- Text ---

/** Zeichen außerhalb von WinAnsi ersetzen (design.md M5 „Text“). */
const REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "≤": "<=",
  "≥": ">=",
  "′": "'",
  "″": '"',
  "−": "-",
  " ": " ",
  " ": " ",
};
// WinAnsi (CP1252): ASCII, Latin-1 ab 0xA0 und diese Zeichen aus 0x80–0x9F
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function pdfText(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (REPLACEMENTS[ch] !== undefined) out += REPLACEMENTS[ch];
    else if (
      (code >= 0x20 && code < 0x7f) ||
      (code >= 0xa0 && code <= 0xff) ||
      CP1252_EXTRA.has(ch)
    )
      out += ch;
    else out += "?";
  }
  return out;
}

export function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Geschätzte Textbreite in mm (Helvetica, Mittelwert). */
export const textWidth = (s: string, size: number) => s.length * size * 0.5;

// --- Plankopf ---

export function titleBlockItems(f: Format, t: TitleBlock): Item[] {
  const r = titleRect(f);
  const items: Item[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, width = LINE.edge): Item => ({
    kind: "line",
    x1,
    y1,
    x2,
    y2,
    width,
  });
  items.push({
    kind: "poly",
    points: [
      [r.x, r.y],
      [r.x + r.width, r.y],
      [r.x + r.width, r.y + r.height],
      [r.x, r.y + r.height],
    ],
    closed: true,
    width: LINE.wallOutline,
    data: "title-block",
  });
  items.push(line(r.x, r.y + 12, r.x + r.width, r.y + 12));
  items.push(line(r.x, r.y + 20, r.x + r.width, r.y + 20));
  items.push(line(r.x, r.y + 28, r.x + r.width, r.y + 28));
  const cell = (
    x: number,
    y: number,
    label: string,
    value: string,
    size: number = TEXT.normal,
    bold = false,
    key = label,
  ) => {
    items.push({
      kind: "text",
      x: x + 1.5,
      y: y + 2.6,
      text: label,
      size: TEXT.small,
      color: COLOR.muted,
    });
    items.push({
      kind: "text",
      x: x + 1.5,
      y: y + (size > TEXT.normal ? 9.5 : 6.6),
      text: pdfText(value),
      size,
      bold,
      data: `title:${key}`,
    });
  };
  cell(r.x, r.y, "Projekt", t.project, TEXT.title, true, "project");
  cell(r.x, r.y + 12, "Planinhalt", t.content, TEXT.normal, true, "content");
  const q = r.width / 4;
  for (let i = 1; i < 4; i++) items.push(line(r.x + i * q, r.y + 20, r.x + i * q, r.y + 28));
  items.push(line(r.x + q, r.y + 28, r.x + q, r.y + 36));
  items.push(line(r.x + 2 * q, r.y + 28, r.x + 2 * q, r.y + 36));
  cell(r.x, r.y + 20, "Geschoss", t.storey || "–", TEXT.normal, false, "storey");
  cell(
    r.x + q,
    r.y + 20,
    "Maßstab",
    t.scale === null ? "ohne" : `1:${t.scale}`,
    TEXT.normal,
    false,
    "scale",
  );
  cell(r.x + 2 * q, r.y + 20, "Datum", t.date, TEXT.normal, false, "date");
  cell(r.x + 3 * q, r.y + 20, "Seite", t.page ?? "", TEXT.normal, false, "page");
  cell(r.x, r.y + 28, "Planstand", t.planStatus, TEXT.normal, false, "planStatus");
  cell(
    r.x + q,
    r.y + 28,
    "Planart",
    t.planKind,
    TEXT.normal,
    t.planKind === "Bestandsplan",
    "planKind",
  );
  cell(r.x + 2 * q, r.y + 28, "Filter", t.filter, TEXT.normal, false, "filter");
  return items;
}

// --- Legende ---

export interface LegendEntry {
  name: string;
  /** SVG-Fragment des Symbols; null = Verteiler (Rechteck) */
  symbol: string | null;
}

export function legendEntries(types: readonly DeviceType[], board: boolean): LegendEntry[] {
  const entries: LegendEntry[] = [...types]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((t) => ({ name: t.name, symbol: t.symbol }));
  if (board) entries.push({ name: "Verteiler", symbol: null });
  return entries;
}

/** Legende in einem Rechteck: Spalten zu 45 mm, Überlauf „… und <n> weitere“. */
export function legendItems(entries: readonly LegendEntry[], r: Rect): Item[] {
  if (entries.length === 0) return [];
  const items: Item[] = [
    { kind: "text", x: r.x, y: r.y + 3, text: "Legende", size: TEXT.normal, bold: true },
  ];
  const rowH = 6;
  const rows = Math.max(1, Math.floor((r.height - 5) / rowH));
  const cols = Math.max(1, Math.floor(r.width / LEGEND_COL_MM));
  const capacity = rows * cols;
  const shown = entries.length > capacity ? entries.slice(0, capacity - 1) : entries;
  shown.forEach((e, i) => {
    const x = r.x + Math.floor(i / rows) * LEGEND_COL_MM;
    const y = r.y + 5 + (i % rows) * rowH;
    if (e.symbol === null)
      items.push({
        kind: "poly",
        points: [
          [x, y + 1],
          [x + 5, y + 1],
          [x + 5, y + 4],
          [x, y + 4],
        ],
        closed: true,
        width: LINE.edge,
        data: "legend-symbol:board",
      });
    else
      items.push({
        kind: "symbol",
        svg: e.symbol,
        x: x + 2.5,
        y: y + 2.5,
        size: 5,
        data: `legend-symbol:${e.name}`,
      });
    items.push({
      kind: "text",
      x: x + 7,
      y: y + 3.4,
      text: pdfText(e.name),
      size: TEXT.normal,
      data: `legend:${e.name}`,
    });
  });
  if (shown.length < entries.length) {
    const i = shown.length;
    items.push({
      kind: "text",
      x: r.x + Math.floor(i / rows) * LEGEND_COL_MM,
      y: r.y + 5 + (i % rows) * rowH + 3.4,
      text: `… und ${entries.length - shown.length} weitere`,
      size: TEXT.normal,
      data: "legend:more",
    });
  }
  return items;
}

// --- Maßstabsleiste ---

const BAR_TICKS: [number, number[]][] = [
  [10, [0, 1, 2, 5, 10]],
  [5, [0, 1, 2, 5]],
  [2, [0, 0.5, 1, 2]],
  [1, [0, 0.25, 0.5, 1]],
];

export function scaleBarItems(scale: number, x: number, y: number, maxWidth = 170): Item[] {
  const [, ticks] = BAR_TICKS.find(([t]) => (t * 1000) / scale <= maxWidth) ?? BAR_TICKS.at(-1)!;
  const items: Item[] = [];
  const px = (m: number) => x + (m * 1000) / scale;
  const end = ticks.at(-1)!;
  items.push({
    kind: "line",
    x1: x,
    y1: y,
    x2: px(end),
    y2: y,
    width: LINE.edge,
    data: "scale-bar",
  });
  for (let i = 0; i < ticks.length; i++) {
    const m = ticks[i]!;
    items.push({ kind: "line", x1: px(m), y1: y - 1.2, x2: px(m), y2: y + 1.2, width: LINE.edge });
    items.push({
      kind: "text",
      x: px(m),
      y: y + 4,
      text: `${String(m).replace(".", ",")}${i === ticks.length - 1 ? " m" : ""}`,
      size: TEXT.small,
      anchor: "middle",
    });
    if (i < ticks.length - 1 && i % 2 === 0)
      items.push({
        kind: "poly",
        points: [
          [px(m), y - 0.6],
          [px(ticks[i + 1]!), y - 0.6],
          [px(ticks[i + 1]!), y],
          [px(m), y],
        ],
        closed: true,
        fill: "#000000",
        stroke: null,
      });
  }
  return items;
}

// --- Maßstab und Passprüfung ---

/** Maßstäbe für die Meldung „braucht 1:k“ (design.md M5 „Passprüfung“). */
export const FIT_SCALES = [20, 25, 50, 100, 200] as const;

/** Passt ein Inhalt (Weltmaß in mm plus feste Papierzugaben) im Maßstab in das Rechteck? */
export function fits(
  content: { widthMm: number; heightMm: number; extraWMm?: number; extraHMm?: number },
  scale: number,
  area: Pick<Rect, "width" | "height">,
): boolean {
  return (
    content.widthMm / scale + (content.extraWMm ?? 0) <= area.width + 1e-6 &&
    content.heightMm / scale + (content.extraHMm ?? 0) <= area.height + 1e-6
  );
}

/** Kleinster der Maßstäbe, bei dem der Inhalt passt; null, wenn keiner. */
export function neededScale(
  content: Parameters<typeof fits>[0],
  area: Pick<Rect, "width" | "height">,
  scales: readonly number[] = FIT_SCALES,
): number | null {
  return scales.find((s) => fits(content, s, area)) ?? null;
}

export function fitMessage(
  content: string,
  scale: number,
  f: Format,
  needed: number | null,
): string {
  return `${content} passt in 1:${scale} nicht auf ${formatLabel(f)}${needed ? ` (braucht 1:${needed})` : ""}`;
}

// --- Abbildung Welt → Papier ---

export interface Placement {
  scale: number;
  /** Weltpunkt (x nach rechts, y nach oben) → Papier (y nach unten) */
  toPaper(x: number, y: number): [number, number];
}

/** Zentriert einen Weltbereich im Rechteck (Papierzugaben links/unten für Maßketten). */
export function placeCentered(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  scale: number,
  area: Rect,
  extra: { left?: number; right?: number; top?: number; bottom?: number } = {},
): Placement {
  const w = (bounds.maxX - bounds.minX) / scale + (extra.left ?? 0) + (extra.right ?? 0);
  const h = (bounds.maxY - bounds.minY) / scale + (extra.top ?? 0) + (extra.bottom ?? 0);
  const ox = area.x + (area.width - w) / 2 + (extra.left ?? 0);
  const oy = area.y + (area.height - h) / 2 + (extra.top ?? 0);
  return {
    scale,
    toPaper: (x, y) => [ox + (x - bounds.minX) / scale, oy + (bounds.maxY - y) / scale],
  };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(points: readonly { x: number; y: number }[]): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
