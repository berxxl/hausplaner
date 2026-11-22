/**
 * Flächen als Blatt (design.md M5 „Planinhalte“): Raumansicht, Wandseite ohne Raum, Decke, Boden,
 * Schräge mit Geräten, Verteilern, Trassen und Maßketten (Bezugsbemaßung ab linker Raumecke und
 * OKFF). Der Zeichenkern dient auch der Baustellen-PDF. Frei von React.
 */
import { boardFrontRect } from "../geometry/boards";
import { frontRect, wallDeviceBuildup } from "../geometry/devices";
import type { Device, DeviceType, Project } from "../model/types";
import type { SurfaceTarget } from "../store/view";
import { surfaceModel, type SurfaceModel } from "../ui/surface/model";
import { routeGeometry } from "../ui/surface/routeGeometry";
import {
  composeSheet,
  contentArea,
  deviceVisible,
  segmentVisible,
  type ContentFilter,
  type ExportOptions,
  type SheetResult,
} from "./compose";
import {
  COLOR,
  fits,
  legendEntries,
  LINE,
  neededScale,
  pdfText,
  placeCentered,
  TEXT,
  type Item,
  type Rect,
} from "./sheet";

/** Papierzugaben für die Maßketten (links: Höhen, unten: Abstände). */
export const DIM_EXTRA = { left: 18, bottom: 18, top: 4, right: 4 } as const;
const DIM_GAP_MM = 8;
const MERGE_MM = 1;

export interface SurfaceFrame {
  scale: number;
  /** u am linken Rand der Kontur und Papier-x dort */
  u0: number;
  x0: number;
  /** Papier-y bei v = 0 */
  y0: number;
}

export interface SurfaceDrawing {
  model: SurfaceModel;
  content: string;
  storey: string;
  items: Item[];
  types: DeviceType[];
  hasBoard: boolean;
  /** Weltmaß der Kontur in mm */
  size: { widthMm: number; heightMm: number };
  frame: SurfaceFrame;
  /** Bezug der Maßketten */
  ref: { u: number; v: number };
}

interface DimPoint {
  id: string;
  u: number;
  v: number;
}

/** Werte zusammenfassen, die bis 1 mm auseinanderliegen (ein Strich je Maß). */
function merge(points: readonly DimPoint[], key: "u" | "v"): { value: number; ids: string[] }[] {
  const sorted = [...points].sort((a, b) => a[key] - b[key]);
  const out: { value: number; ids: string[] }[] = [];
  for (const p of sorted) {
    const last = out.at(-1);
    if (last && Math.abs(p[key] - last.value) <= MERGE_MM) last.ids.push(p.id);
    else out.push({ value: p[key], ids: [p.id] });
  }
  return out;
}

/** Zeichnet eine Fläche maßstäblich in ein Rechteck (zentriert mit Maßkettenzugaben). */
export function surfaceDrawing(
  project: Project,
  target: SurfaceTarget,
  o: ContentFilter,
  scale: number,
  area: Rect,
): SurfaceDrawing | null {
  const model = surfaceModel(project, target);
  if (!model) return null;
  const storey = project.storeys.find((s) => s.id === model.storeyId);
  const us = model.contour.map((p) => p.u);
  const vs = model.contour.map((p) => p.v);
  const bounds = {
    minX: Math.min(...us),
    maxX: Math.max(...us),
    minY: Math.min(...vs),
    maxY: Math.max(...vs),
  };
  const pl = placeCentered(bounds, scale, area, DIM_EXTRA);
  const P = (u: number, v: number) => pl.toPaper(u, v);
  const k = 1 / scale;
  const items: Item[] = [];
  const wallSide = model.kind === "wall-side";
  const inRange = (u: number) => !model.uRange || (u >= model.uRange[0] && u <= model.uRange[1]);

  // Kontur und Öffnungen
  items.push({
    kind: "poly",
    points: model.contour.map((p) => P(p.u, p.v)),
    closed: true,
    width: LINE.edge,
    data: "contour",
  });
  for (const op of model.openings) {
    const r: [number, number][] = [
      P(op.uFrom, op.vFrom),
      P(op.uTo, op.vFrom),
      P(op.uTo, op.vTo),
      P(op.uFrom, op.vTo),
    ];
    items.push({
      kind: "poly",
      points: r,
      closed: true,
      fill: "#f2f2f2",
      width: LINE.opening,
      data: `opening:${op.id}`,
    });
  }

  // OKFF (Raumansicht) bzw. Rohfußboden (Wandseite ohne Raum)
  const isWall = model.kind === "room-wall" || wallSide;
  if (isWall) {
    const [x1, y] = P(bounds.minX, 0);
    const [x2] = P(bounds.maxX, 0);
    items.push({
      kind: "line",
      x1,
      y1: y,
      x2,
      y2: y,
      width: LINE.dimension,
      dash: [1, 0.6],
      data: "okff",
    });
  }

  // Trassen
  const routes = routeGeometry(project, model);
  const shownSegments = routes.segments.filter((s) => {
    const seg = project.routeSegments.find((x) => x.id === s.id);
    return seg ? segmentVisible(project, o, seg) : false;
  });
  for (const s of shownSegments) {
    const [x1, y1] = P(s.a.u, s.a.v);
    const [x2, y2] = P(s.b.u, s.b.v);
    items.push({ kind: "line", x1, y1, x2, y2, width: LINE.route, data: `segment:${s.id}` });
  }
  const shownNodeIds = new Set(
    shownSegments.flatMap((s) => {
      const seg = project.routeSegments.find((x) => x.id === s.id)!;
      return [seg.a, seg.b];
    }),
  );
  const nodes = routes.nodes.filter((n) => shownNodeIds.has(n.id) && !n.device);
  for (const n of nodes) {
    const [cx, cy] = P(n.at.u, n.at.v);
    items.push({
      kind: "circle",
      cx,
      cy,
      r: 0.6,
      fill: "#000000",
      stroke: null,
      data: `node:${n.id}`,
    });
  }
  for (const pen of routes.penetrations) {
    const seg = project.routeSegments.find((x) => x.id === pen.id);
    if (!seg || !segmentVisible(project, o, seg)) continue;
    const [cx, cy] = P(pen.at.u, pen.at.v);
    items.push({
      kind: "circle",
      cx,
      cy,
      r: Math.max((pen.diameterMm / 2) * k, 0.8),
      width: LINE.edge,
      data: `penetration:${pen.id}`,
    });
  }

  // Verteiler
  const dims: DimPoint[] = nodes.map((n) => ({ id: n.id, u: n.at.u, v: n.at.v }));
  const boards = project.boards.filter(
    (b) => b.placement.surface === model.ref && inRange(b.placement.u),
  );
  for (const b of boards) {
    const probe = {
      storeyId: b.storeyId,
      placement: {
        kind: "surface",
        surface: b.placement.surface,
        u: b.placement.u,
        v: 0,
        rotationDeg: 0,
      },
    } as Device;
    const dv = wallSide ? wallDeviceBuildup(project, probe) : 0;
    const r = boardFrontRect(b);
    const pts: [number, number][] = [
      P(r.uFrom, r.vFrom + dv),
      P(r.uTo, r.vFrom + dv),
      P(r.uTo, r.vTo + dv),
      P(r.uFrom, r.vTo + dv),
    ];
    items.push({
      kind: "poly",
      points: pts,
      closed: true,
      fill: "#e0e0e0",
      width: LINE.edge,
      dash: b.mounting === "flush" ? [1, 0.6] : undefined,
      data: `board:${b.id}`,
    });
    const [cx, cy] = P(b.placement.u, b.placement.v + dv);
    items.push({
      kind: "text",
      x: cx,
      y: cy,
      text: pdfText(b.label),
      size: TEXT.normal,
      anchor: "middle",
      bold: true,
    });
    dims.push({ id: b.id, u: b.placement.u, v: b.placement.v + dv });
  }

  // Geräte: Frontrechteck mit Symbol
  const types = new Map<string, DeviceType>();
  for (const d of project.devices) {
    const p = d.placement;
    if (p.kind !== "surface" || p.surface !== model.ref || !inRange(p.u)) continue;
    if (!deviceVisible(project, o, d)) continue;
    const t = project.catalog.deviceTypes.find((x) => x.id === d.typeId);
    if (t) types.set(t.id, t);
    const dv = wallSide ? wallDeviceBuildup(project, d) : 0;
    const r = frontRect(d, t)!;
    const [x1, y1] = P(r.uMin, r.vMax + dv);
    const [x2, y2] = P(r.uMax, r.vMin + dv);
    items.push({
      kind: "poly",
      points: [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ],
      closed: true,
      fill: "#ffffff",
      width: LINE.opening,
      data: `device:${d.id}`,
    });
    if (t)
      items.push({
        kind: "symbol",
        svg: t.symbol,
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        size: Math.min(x2 - x1, y2 - y1),
        rotate: p.rotationDeg || undefined,
        data: `symbol:${d.id}`,
      });
    dims.push({ id: d.id, u: p.u, v: p.v + dv });
  }

  // Maßketten: u ab linker Raumecke (Raumansicht) bzw. Konturanfang, v ab OKFF bzw. Konturunterkante
  const ref = {
    u: model.roomView ? model.roomView.finished.uFrom : bounds.minX,
    v: isWall ? 0 : bounds.minY,
  };
  const [, bottomY] = P(bounds.minX, bounds.minY);
  const [leftX] = P(bounds.minX, bounds.minY);
  const lineY = bottomY + DIM_GAP_MM;
  const lineX = leftX - DIM_GAP_MM;
  const uTicks = merge(dims, "u");
  const vTicks = merge(dims, "v");
  if (uTicks.length > 0) {
    const [xa] = P(ref.u, 0);
    const xb = Math.max(xa, ...uTicks.map((t) => P(t.value, 0)[0]));
    items.push({
      kind: "line",
      x1: xa,
      y1: lineY,
      x2: xb,
      y2: lineY,
      width: LINE.dimension,
      data: "dim-u-line",
    });
    items.push({
      kind: "line",
      x1: xa,
      y1: lineY - 1.5,
      x2: xa,
      y2: lineY + 1.5,
      width: LINE.dimension,
    });
    items.push({
      kind: "text",
      x: xa,
      y: lineY + 2,
      text: "0",
      size: TEXT.small,
      anchor: "end",
      rotate: -90,
    });
    for (const t of uTicks) {
      const [x] = P(t.value, 0);
      items.push({
        kind: "line",
        x1: x,
        y1: lineY - 1.5,
        x2: x,
        y2: lineY + 1.5,
        width: LINE.dimension,
      });
      items.push({
        kind: "text",
        x: x + 0.6,
        y: lineY + 2,
        text: String(Math.round(t.value - ref.u)),
        size: TEXT.small,
        anchor: "end",
        rotate: -90,
        data: `dim-u:${t.ids.join(",")}`,
      });
    }
  }
  if (vTicks.length > 0) {
    const [, ya] = P(0, ref.v);
    const yb = Math.min(ya, ...vTicks.map((t) => P(0, t.value)[1]));
    items.push({
      kind: "line",
      x1: lineX,
      y1: ya,
      x2: lineX,
      y2: yb,
      width: LINE.dimension,
      data: "dim-v-line",
    });
    items.push({
      kind: "line",
      x1: lineX - 1.5,
      y1: ya,
      x2: lineX + 1.5,
      y2: ya,
      width: LINE.dimension,
    });
    items.push({
      kind: "text",
      x: lineX - 2,
      y: ya + 0.6,
      text: isWall ? "±0" : "0",
      size: TEXT.small,
      anchor: "end",
    });
    for (const t of vTicks) {
      const [, y] = P(0, t.value);
      items.push({
        kind: "line",
        x1: lineX - 1.5,
        y1: y,
        x2: lineX + 1.5,
        y2: y,
        width: LINE.dimension,
      });
      items.push({
        kind: "text",
        x: lineX - 2,
        y: y + 0.6,
        text: String(Math.round(t.value - ref.v)),
        size: TEXT.small,
        anchor: "end",
        data: `dim-v:${t.ids.join(",")}`,
      });
    }
  }
  if (isWall) {
    const [, y] = P(0, 0);
    const label = model.kind === "room-wall" ? "±0 OKFF" : "±0 Rohfußboden";
    const [x2] = P(bounds.maxX, 0);
    items.push({
      kind: "text",
      x: x2 + 1,
      y: y + 0.6,
      text: label,
      size: TEXT.small,
      color: COLOR.muted,
    });
  }

  const [x0, y0] = P(bounds.minX, 0);
  return {
    model,
    content: model.title,
    storey: storey?.name ?? "",
    items,
    types: [...types.values()],
    hasBoard: boards.length > 0,
    size: { widthMm: bounds.maxX - bounds.minX, heightMm: bounds.maxY - bounds.minY },
    frame: { scale, u0: bounds.minX, x0, y0 },
    ref,
  };
}

export const surfaceFitContent = (size: { widthMm: number; heightMm: number }) => ({
  ...size,
  extraWMm: DIM_EXTRA.left + DIM_EXTRA.right,
  extraHMm: DIM_EXTRA.top + DIM_EXTRA.bottom,
});

/** Fläche als Exportblatt mit Plankopf, Legende und Maßstabsleiste. */
export function surfaceSheet(
  project: Project,
  target: SurfaceTarget,
  o: ExportOptions,
): SheetResult | null {
  // Legende hängt von den gezeigten Geräten ab: erst mit Legendenstreifen messen
  const probeArea = contentArea(o.format, true, true);
  const probe = surfaceDrawing(project, target, o, o.scale, probeArea);
  if (!probe) return null;
  const legend = legendEntries(probe.types, probe.hasBoard);
  const area = contentArea(o.format, true, legend.length > 0);
  const d = surfaceDrawing(project, target, o, o.scale, area)!;
  const content = surfaceFitContent(d.size);
  const ok = fits(content, o.scale, area);
  const sheet = composeSheet(o, {
    content: d.content,
    storey: d.storey,
    scale: o.scale,
    items: d.items,
    legend,
  });
  return {
    sheet,
    content: d.content,
    fit: { ok, needed: ok ? o.scale : neededScale(content, area) },
  };
}
