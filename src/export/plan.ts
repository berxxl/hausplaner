/**
 * Grundriss je Geschoss als Blatt (design.md M5 „Planinhalte“): Wände, Öffnungen, Raumgrenzen,
 * Raumnamen mit Fläche, Verteiler, Geräte mit Symbol und Kurzname, Trassen, Durchbrüche, Nordpfeil.
 * Frei von React.
 */
import { boardPlanRect } from "../geometry/boards";
import { circuitShortName } from "../geometry/circuits";
import { fromPath, union } from "../geometry/clipper";
import { PLAN_SYMBOL_MM, planSymbol } from "../geometry/devices";
import { openingFootprint } from "../geometry/openings";
import { centroid } from "../geometry/polygon";
import { finishedArea } from "../geometry/rooms";
import { segmentWorldEnds } from "../geometry/routes";
import type { Vec } from "../geometry/vec";
import { wallBody } from "../geometry/walls";
import { surfaceKind } from "../model/devices";
import { formatArea } from "../model/units";
import type { DeviceType, Project } from "../model/types";
import { wallGeoms } from "../store/building";
import {
  composeSheet,
  contentArea,
  deviceVisible,
  segmentVisible,
  type ExportOptions,
  type SheetResult,
} from "./compose";
import {
  boundsOf,
  COLOR,
  fits,
  legendEntries,
  LINE,
  neededScale,
  pdfText,
  placeCentered,
  TEXT,
  type Item,
} from "./sheet";

export function planSheet(
  project: Project,
  storeyId: string,
  o: ExportOptions,
): SheetResult | null {
  const storey = project.storeys.find((s) => s.id === storeyId);
  if (!storey) return null;
  const content = `Grundriss ${storey.name}`;
  const geoms = wallGeoms(project, storeyId);
  const bodies = geoms.map((w) => ({ id: w.id, poly: wallBody(geoms, w) }));
  const outline = bodies.length > 0 ? union(bodies.map((b) => b.poly)).map((p) => fromPath(p)) : [];
  const wallIds = new Set(geoms.map((w) => w.id));
  const openings = project.openings.filter((x) => wallIds.has(x.wallId));
  const rooms = project.rooms.filter((r) => r.storeyId === storeyId && r.polygon.length >= 3);
  const boundaries = project.roomBoundaries.filter((b) => b.storeyId === storeyId);
  const devices = project.devices
    .filter((d) => d.storeyId === storeyId && d.placement.kind !== "board")
    .filter((d) => deviceVisible(project, o, d))
    .flatMap((d) => {
      const at = planSymbol(project, d);
      return at ? [{ device: d, at }] : [];
    });
  const boards = project.boards
    .filter((b) => b.storeyId === storeyId)
    .flatMap((b) => {
      const rect = boardPlanRect(project, b);
      return rect ? [{ board: b, rect }] : [];
    });
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  const segments = project.routeSegments
    .filter((s) => segmentVisible(project, o, s))
    .flatMap((s) => {
      const ends = segmentWorldEnds(project, s, nodes);
      return ends ? [{ s, ends }] : [];
    });

  const half = PLAN_SYMBOL_MM / 2;
  const pts: Vec[] = [
    ...bodies.flatMap((b) => b.poly),
    ...rooms.flatMap((r) => r.polygon),
    ...devices.flatMap(({ at }) => [
      { x: at.x - half, y: at.y - half },
      { x: at.x + half, y: at.y + half },
    ]),
    ...boards.flatMap((b) => b.rect),
  ];
  if (pts.length === 0) pts.push({ x: 0, y: 0 }, { x: 1000, y: 1000 });
  const bounds = boundsOf(pts);
  const types = new Map<string, DeviceType>();
  for (const { device } of devices) {
    const t = project.catalog.deviceTypes.find((x) => x.id === device.typeId);
    if (t) types.set(t.id, t);
  }
  const legend = legendEntries([...types.values()], boards.length > 0);
  const area = contentArea(o.format, true, legend.length > 0);
  const size = { widthMm: bounds.maxX - bounds.minX, heightMm: bounds.maxY - bounds.minY };
  const ok = fits(size, o.scale, area);
  const pl = placeCentered(bounds, o.scale, area);
  const P = (p: Vec): [number, number] => pl.toPaper(p.x, p.y);
  const k = 1 / o.scale;
  const items: Item[] = [];

  // Räume (weiß, damit Raster und Hintergrund nicht stören), Wände, Öffnungen
  for (const b of bodies)
    items.push({
      kind: "poly",
      points: b.poly.map(P),
      closed: true,
      fill: COLOR.wall,
      stroke: null,
      data: `wall:${b.id}`,
    });
  if (outline.length > 0)
    items.push({
      kind: "path",
      rings: outline.map((r) => r.map(P)),
      fill: "none",
      width: LINE.wallOutline,
      data: "walls",
    });
  const byId = new Map(geoms.map((w) => [w.id, w]));
  for (const op of openings) {
    const fp = openingFootprint(byId.get(op.wallId)!, op);
    items.push({
      kind: "poly",
      points: fp.map(P),
      closed: true,
      fill: "#ffffff",
      width: LINE.opening,
      data: `opening:${op.id}`,
    });
    if (op.kind === "window") {
      const m1 = { x: (fp[0]!.x + fp[3]!.x) / 2, y: (fp[0]!.y + fp[3]!.y) / 2 };
      const m2 = { x: (fp[1]!.x + fp[2]!.x) / 2, y: (fp[1]!.y + fp[2]!.y) / 2 };
      items.push(line(P(m1), P(m2), LINE.opening));
    } else if (op.kind === "door") items.push(line(P(fp[0]!), P(fp[2]!), LINE.opening));
  }
  for (const b of boundaries)
    items.push({
      ...line(P(b.start), P(b.end), LINE.edge),
      dash: [1.5, 1],
      data: `boundary:${b.id}`,
    });

  // Trassen und Durchbrüche
  for (const { s, ends } of segments) {
    if (s.kind === "surface" && s.surface) {
      const kind = surfaceKind(s.surface);
      if (kind === "wall" || ends.a.storeyId !== storeyId) continue;
      items.push({
        ...line(P(ends.a), P(ends.b), LINE.route),
        dash: kind === "floor" ? undefined : [2, 1],
        data: `segment:${s.id}`,
      });
    } else if (s.penetration) {
      if (ends.a.storeyId === ends.b.storeyId) {
        if (ends.a.storeyId !== storeyId) continue;
        items.push({ ...line(P(ends.a), P(ends.b), 0.5), data: `segment:${s.id}` });
      } else {
        const own =
          ends.a.storeyId === storeyId ? ends.a : ends.b.storeyId === storeyId ? ends.b : null;
        if (!own) continue;
        const [cx, cy] = P(own);
        items.push({
          kind: "circle",
          cx,
          cy,
          r: Math.max((s.penetration.diameterMm / 2) * k, 0.8),
          width: LINE.edge,
          data: `segment:${s.id}`,
        });
      }
    }
  }

  // Verteiler
  for (const { board, rect } of boards) {
    items.push({
      kind: "poly",
      points: rect.map(P),
      closed: true,
      fill: "#e0e0e0",
      width: LINE.edge,
      data: `board:${board.id}`,
    });
    const [cx, cy] = P(centroid(rect));
    items.push({
      kind: "text",
      x: cx,
      y: cy - 2,
      text: pdfText(board.label),
      size: TEXT.small,
      anchor: "middle",
      bold: true,
    });
  }

  // Geräte: Rahmen mit Symbol (250 mm Welt), Decke gestrichelt, Stromkreis-Kurzname darunter
  const side = PLAN_SYMBOL_MM * k;
  for (const { device, at } of devices) {
    const [cx, cy] = P(at);
    const t = types.get(device.typeId);
    items.push({
      kind: "poly",
      points: [
        [cx - side / 2, cy - side / 2],
        [cx + side / 2, cy - side / 2],
        [cx + side / 2, cy + side / 2],
        [cx - side / 2, cy + side / 2],
      ],
      closed: true,
      fill: "#ffffff",
      width: LINE.opening,
      dash: at.frame === "ceiling" ? [0.8, 0.5] : undefined,
      data: `device:${device.id}`,
    });
    if (t)
      items.push({
        kind: "symbol",
        svg: t.symbol,
        x: cx,
        y: cy,
        size: side,
        data: `symbol:${device.id}`,
      });
    const c = project.circuits.find((x) => x.id === device.circuitId);
    if (c)
      items.push({
        kind: "text",
        x: cx,
        y: cy + side / 2 + 2,
        text: pdfText(circuitShortName(c.label)),
        size: TEXT.small,
        anchor: "middle",
        data: `circuit-label:${device.id}`,
      });
  }

  // Raumnamen mit fertiger Fläche
  for (const r of rooms) {
    const [cx, cy] = P(centroid(r.polygon));
    const plaster = r.plasterMm ?? storey.defaults.plasterMm;
    items.push({
      kind: "text",
      x: cx,
      y: cy,
      text: pdfText(r.name),
      size: TEXT.room,
      anchor: "middle",
      bold: true,
      data: `room:${r.id}`,
    });
    items.push({
      kind: "text",
      x: cx,
      y: cy + 4,
      text: pdfText(formatArea(finishedArea(r.polygon, plaster))),
      size: TEXT.normal,
      anchor: "middle",
      data: `area:${r.id}`,
    });
  }

  items.push(...northArrow(project.settings.northDeg, area.x + area.width - 8, area.y + 8));

  const sheet = composeSheet(o, { content, storey: storey.name, scale: o.scale, items, legend });
  return { sheet, content, fit: { ok, needed: ok ? o.scale : neededScale(size, area) } };
}

function line(
  a: [number, number],
  b: [number, number],
  width: number,
): Extract<Item, { kind: "line" }> {
  return { kind: "line", x1: a[0], y1: a[1], x2: b[0], y2: b[1], width };
}

/** Nordpfeil: Kreis, Pfeil um die Nordrichtung gedreht (im Uhrzeigersinn), „N“ aufrecht. */
export function northArrow(northDeg: number, cx: number, cy: number): Item[] {
  const rad = (northDeg * Math.PI) / 180;
  const rot = (x: number, y: number): [number, number] => [
    cx + x * Math.cos(rad) - y * Math.sin(rad),
    cy + x * Math.sin(rad) + y * Math.cos(rad),
  ];
  const [nx, ny] = rot(0, -5.2);
  return [
    { kind: "circle", cx, cy, r: 6, width: LINE.dimension, data: "north-arrow" },
    {
      kind: "poly",
      points: [rot(0, -3), rot(2, 4), rot(0, 2.4), rot(-2, 4)],
      closed: true,
      fill: "#000000",
      stroke: null,
    },
    {
      kind: "text",
      x: nx,
      y: ny - 1.2,
      text: "N",
      size: TEXT.normal,
      anchor: "middle",
      bold: true,
    },
  ];
}
