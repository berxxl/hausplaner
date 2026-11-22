/**
 * Baustellen-PDF (design.md M5 „Baustellen-PDF“): je Raum je Raumansicht, Decke, Boden und
 * Schräge eine A4-Seite, Maßstab 1:20 (sonst 1:25, 1:50) mit passender Ausrichtung, Raster in
 * Flächenmaß, Maßketten, Notizbereich und Seitenzuordnung. Frei von React.
 */
import { deriveRoomViews } from "../geometry/surfaces";
import type { Project } from "../model/types";
import type { SurfaceTarget } from "../store/view";
import { composeSheet, type ExportOptions } from "./compose";
import { SITE_PDF_FORMAT, type SiteMapping, type SitePageMapping } from "./mapping";
import { sortedRooms, sortedStoreys } from "./selection";
import {
  COLOR,
  drawingArea,
  fits,
  LINE,
  pdfText,
  TEXT,
  type Format,
  type Item,
  type Rect,
  type Sheet,
} from "./sheet";
import { surfaceDrawing, surfaceFitContent } from "./surface";

export const SITE_SCALES = [20, 25, 50] as const;
const NOTES_MIN_MM = 40;
const NOTES_GAP_MM = 5;
const HEADING_MM = 8;
const GRID_FINE_MM = 100;
const GRID_BOLD_MM = 1000;
const GRID_LABEL_MM = 500;

const PORTRAIT: Format = { paper: "A4", orientation: "portrait" };
const LANDSCAPE: Format = { paper: "A4", orientation: "landscape" };

/** Platz für die Zeichnung: unter der Überschrift, neben (quer) bzw. über (hoch) dem Notizbereich. */
function drawingRegion(f: Format): Rect {
  const a = drawingArea(f);
  const y = a.y + HEADING_MM;
  const h = a.height - HEADING_MM;
  return f.orientation === "portrait"
    ? { x: a.x, y, width: a.width, height: h - NOTES_MIN_MM - NOTES_GAP_MM }
    : { x: a.x, y, width: a.width - NOTES_MIN_MM - NOTES_GAP_MM, height: h };
}

/** Größter Maßstab aus 1:20, 1:25, 1:50, bei dem die Fläche auf A4 passt; hoch bei Gleichstand. */
export function chooseSiteLayout(size: {
  widthMm: number;
  heightMm: number;
}): { scale: number; format: Format } | null {
  const content = surfaceFitContent(size);
  for (const scale of SITE_SCALES)
    for (const format of [PORTRAIT, LANDSCAPE])
      if (fits(content, scale, drawingRegion(format))) return { scale, format };
  return null;
}

/** Ziele der Baustellen-PDF in Baumreihenfolge. */
export function siteTargets(project: Project, roomIds: readonly string[]): SurfaceTarget[] {
  const views = deriveRoomViews(project);
  const out: SurfaceTarget[] = [];
  for (const storey of sortedStoreys(project))
    for (const room of sortedRooms(project, storey.id)) {
      if (!roomIds.includes(room.id)) continue;
      for (const v of views.get(room.id) ?? []) out.push({ kind: "room-wall", key: v.key });
      out.push({ kind: "ceiling", roomId: room.id }, { kind: "floor", roomId: room.id });
      for (const sl of room.slopes ?? [])
        out.push({ kind: "slope", roomId: room.id, slopeId: sl.id });
    }
  return out;
}

export interface SitePage {
  sheet: Sheet;
  content: string;
  mapping: Omit<SitePageMapping, "page">;
}

export interface SiteResult {
  pages: SitePage[];
  /** Flächen, die auch in 1:50 nicht auf A4 passen */
  errors: string[];
}

type SiteOptions = Omit<ExportOptions, "format" | "scale">;

export function sitePage(
  project: Project,
  target: SurfaceTarget,
  o: SiteOptions,
): SitePage | string | null {
  const probe = surfaceDrawing(project, target, o, 20, drawingRegion(PORTRAIT));
  if (!probe) return null;
  const layout = chooseSiteLayout(probe.size);
  if (!layout) return `${probe.content} passt auch in 1:50 nicht auf A4`;
  const { scale, format } = layout;
  const region = drawingRegion(format);
  // Zeichnung oben links in ihrem Bereich, damit der Notizbereich möglichst groß wird
  const fit = surfaceFitContent(probe.size);
  const w = fit.widthMm / scale + fit.extraWMm;
  const h = fit.heightMm / scale + fit.extraHMm;
  const placed: Rect = { x: region.x, y: region.y, width: w, height: h };
  const d = surfaceDrawing(project, target, o, scale, placed)!;
  const area = drawingArea(format);

  const items: Item[] = [...gridItems(d), ...d.items];
  const heading =
    scale === 20 ? `${d.content} · Maßstab 1:20` : `${d.content} · Maßstab 1:${scale} (nicht 1:20)`;
  items.push({
    kind: "text",
    x: area.x,
    y: area.y + 5,
    text: pdfText(heading),
    size: TEXT.room,
    bold: true,
    data: "site-heading",
  });
  const notes: Rect =
    format.orientation === "portrait"
      ? {
          x: area.x,
          y: placed.y + h + NOTES_GAP_MM,
          width: area.width,
          height: area.y + area.height - (placed.y + h + NOTES_GAP_MM),
        }
      : {
          x: placed.x + w + NOTES_GAP_MM,
          y: region.y,
          width: area.x + area.width - (placed.x + w + NOTES_GAP_MM),
          height: region.height,
        };
  items.push({
    kind: "poly",
    points: [
      [notes.x, notes.y],
      [notes.x + notes.width, notes.y],
      [notes.x + notes.width, notes.y + notes.height],
      [notes.x, notes.y + notes.height],
    ],
    closed: true,
    width: LINE.edge,
    data: "notes",
  });
  items.push({
    kind: "text",
    x: notes.x + 2,
    y: notes.y + 5,
    text: "Notizen",
    size: TEXT.normal,
    bold: true,
  });

  const sheet = composeSheet(
    { ...o, format, scale },
    { content: d.content, storey: d.storey, scale, items, legend: [], format, scaleBar: false },
  );
  const roomId =
    target.kind === "room-wall"
      ? (d.model.roomView?.roomId ?? null)
      : "roomId" in target
        ? target.roomId
        : null;
  return {
    sheet,
    content: d.content,
    mapping: {
      surface: d.model.ref,
      roomId,
      view: d.content,
      scale,
      originMm: [d.frame.x0, d.frame.y0],
      uRange: [d.frame.u0, d.frame.u0 + d.size.widthMm],
    },
  };
}

/** Raster in Flächenmaß über der Kontur: 100 mm fein, 1 m kräftig, Beschriftung alle 0,5 m. */
function gridItems(d: NonNullable<ReturnType<typeof surfaceDrawing>>): Item[] {
  const { scale, u0, x0, y0 } = d.frame;
  const us = d.model.contour.map((p) => p.u);
  const vs = d.model.contour.map((p) => p.v);
  const [uMin, uMax, vMin, vMax] = [
    Math.min(...us),
    Math.max(...us),
    Math.min(...vs),
    Math.max(...vs),
  ];
  const X = (u: number) => x0 + (u - u0) / scale;
  const Y = (v: number) => y0 - v / scale;
  const items: Item[] = [];
  const steps = (from: number, to: number, ref: number) => {
    const out: number[] = [];
    for (let k = Math.ceil((from - ref) / GRID_FINE_MM); ref + k * GRID_FINE_MM <= to + 1e-6; k++)
      out.push(k * GRID_FINE_MM);
    return out;
  };
  const label = (mm: number) => `${String(mm / 1000).replace(".", ",")} m`;
  for (const off of steps(uMin, uMax, d.ref.u)) {
    const x = X(d.ref.u + off);
    const bold = Math.abs(off % GRID_BOLD_MM) < 1e-6;
    items.push({
      kind: "line",
      x1: x,
      y1: Y(vMin),
      x2: x,
      y2: Y(vMax),
      width: bold ? LINE.gridBold : LINE.gridFine,
      color: bold ? COLOR.gridBold : COLOR.gridFine,
      data: bold ? "grid-bold" : "grid-fine",
    });
    if (off > 0 && Math.abs(off % GRID_LABEL_MM) < 1e-6)
      items.push({
        kind: "text",
        x,
        y: Y(vMax) - 1.5,
        text: label(off),
        size: TEXT.small,
        anchor: "middle",
        color: COLOR.muted,
      });
  }
  for (const off of steps(vMin, vMax, d.ref.v)) {
    const y = Y(d.ref.v + off);
    const bold = Math.abs(off % GRID_BOLD_MM) < 1e-6;
    items.push({
      kind: "line",
      x1: X(uMin),
      y1: y,
      x2: X(uMax),
      y2: y,
      width: bold ? LINE.gridBold : LINE.gridFine,
      color: bold ? COLOR.gridBold : COLOR.gridFine,
      data: bold ? "grid-bold" : "grid-fine",
    });
    if (off > 0 && Math.abs(off % GRID_LABEL_MM) < 1e-6)
      items.push({
        kind: "text",
        x: X(uMax) + 1,
        y: y + 0.6,
        text: label(off),
        size: TEXT.small,
        color: COLOR.muted,
      });
  }
  return items;
}

/** Alle Seiten der Baustellen-PDF für die gewählten Räume, mit Seitenzuordnung. */
export function siteSheets(
  project: Project,
  roomIds: readonly string[],
  o: SiteOptions,
  exportedAt: string,
): SiteResult & { mapping: SiteMapping } {
  const pages: SitePage[] = [];
  const errors: string[] = [];
  for (const t of siteTargets(project, roomIds)) {
    const r = sitePage(project, t, o);
    if (typeof r === "string") errors.push(r);
    else if (r) pages.push(r);
  }
  pages.forEach((p, i) => (p.sheet.title.page = `${i + 1}/${pages.length}`));
  for (const p of pages) {
    const t = p.sheet.items.find((i) => i.data === "title:page");
    if (t && t.kind === "text") t.text = p.sheet.title.page!;
  }
  return {
    pages,
    errors,
    mapping: {
      format: SITE_PDF_FORMAT,
      version: 1,
      project: o.project,
      exportedAt,
      pages: pages.map((p, i) => ({ page: i + 1, ...p.mapping })),
    },
  };
}
