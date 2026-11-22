/**
 * Zeilen der Listen (design.md M5 „Die Listen im Einzelnen“): Geräte, Stromkreise, KNX-Kanäle,
 * Leitungen mit Summen, Durchbrüche. Frei von React.
 */
import { routeGraph, cableLength, endpointLabel } from "../geometry/cables";
import { cableCircuit, circuitDevices, deviceRoom, lineTypeTrade } from "../geometry/circuits";
import { sectionAt } from "../geometry/devices";
import { actuatorProvides, channelLabel, KNX_FUNCTION_LABELS } from "../geometry/knx";
import {
  deriveRoomViews,
  freeSurfaces,
  sections,
  type RoomView,
  type Section,
} from "../geometry/surfaces";
import { surfaceKind } from "../model/devices";
import type { Board, Device, Endpoint, Project, Room, RouteSegment } from "../model/types";
import { PENETRATION_LABELS, STATUS_LABELS, TRADE_LABELS } from "../ui/labels";
import { connectionEntries, NOT_CONNECTED } from "./connection";
import { formatMeters, num, sortBy, text, type Column, type Row } from "./filter";

/** Abgeleitete Hilfsdaten eines Projektstands für alle Listen. */
export interface ReportContext {
  project: Project;
  storeyOrder: Map<string, number>;
  roomViews: Map<string, RoomView[]>;
  sections: Map<string, Section[]>;
}

const contextCache = new WeakMap<Project, ReportContext>();

export function reportContext(project: Project): ReportContext {
  let c = contextCache.get(project);
  if (c) return c;
  const storeyOrder = new Map(
    [...project.storeys]
      .sort((a, b) => a.elevationMm - b.elevationMm)
      .map((s, i) => [s.id, i] as const),
  );
  c = {
    project,
    storeyOrder,
    roomViews: deriveRoomViews(project),
    sections: new Map(project.storeys.map((s) => [s.id, sections(project, s.id)])),
  };
  contextCache.set(project, c);
  return c;
}

const storeyCell = (ctx: ReportContext, storeyId: string | undefined) => {
  const s = ctx.project.storeys.find((x) => x.id === storeyId);
  return s ? { text: s.name, sort: ctx.storeyOrder.get(s.id) ?? 0 } : text(null);
};

const typeOf = (project: Project, d: Device) =>
  project.catalog.deviceTypes.find((t) => t.id === d.typeId);

/** Raum eines Punkts auf einer Wandseite (Abschnitt bei u). */
function wallRoom(ctx: ReportContext, storeyId: string, ref: string, u: number): Room | null {
  const s = sectionAt(ctx.sections.get(storeyId) ?? [], ref, u);
  return s ? (ctx.project.rooms.find((r) => r.id === s.roomId) ?? null) : null;
}

/** Raumansicht, die einen Punkt der Wandseite zeigt. */
function roomViewAt(ctx: ReportContext, roomId: string, ref: string, u: number) {
  return (ctx.roomViews.get(roomId) ?? []).find(
    (v) => v.ref === ref && u >= v.section.uFrom && u <= v.section.uTo,
  );
}

/** Name der Fläche wie im Baum: Raumansicht, „Decke“, „Boden“, „Schräge n“, „frei“. */
export function surfaceLabel(ctx: ReportContext, storeyId: string, ref: string, u: number): string {
  const kind = surfaceKind(ref);
  if (kind === "ceiling") return "Decke";
  if (kind === "floor") return "Boden";
  if (kind === "slope") {
    const [, roomId, slopeId] = ref.split(":");
    const room = ctx.project.rooms.find((r) => r.id === roomId);
    const i = room?.slopes?.findIndex((s) => s.id === slopeId) ?? -1;
    return i >= 0 ? `Schräge ${i + 1}` : "Schräge";
  }
  const room = wallRoom(ctx, storeyId, ref, u);
  const view = room && roomViewAt(ctx, room.id, ref, u);
  if (view) return view.name;
  return freeSurfaces(ctx.project, storeyId).find((f) => f.ref === ref)?.name ?? "Wand";
}

function boardRoom(ctx: ReportContext, board: Board): Room | null {
  return wallRoom(ctx, board.storeyId, board.placement.surface, board.placement.u);
}

function endpointPlace(ctx: ReportContext, ep: Endpoint): { storeyId?: string; roomId?: string } {
  if (ep.boardId !== undefined) {
    const b = ctx.project.boards.find((x) => x.id === ep.boardId);
    return b ? { storeyId: b.storeyId, roomId: boardRoom(ctx, b)?.id } : {};
  }
  const d = ctx.project.devices.find((x) => x.id === ep.deviceId);
  if (!d) return {};
  const p = d.placement;
  if (p.kind === "board") {
    const b = ctx.project.boards.find((x) => x.id === p.boardId);
    return b ? { storeyId: b.storeyId, roomId: boardRoom(ctx, b)?.id } : {};
  }
  return { storeyId: d.storeyId, roomId: deviceRoom(ctx.project, d)?.id };
}

const compact = <T>(xs: (T | undefined | null)[]) => xs.filter((x): x is T => x != null);

// --- Geräte ---

export type DeviceColumn =
  "label" | "type" | "trade" | "storey" | "room" | "surface" | "height" | "status" | "connection";

export const DEVICE_COLUMNS: Column<DeviceColumn>[] = [
  { key: "label", label: "Bezeichnung" },
  { key: "type", label: "Typ" },
  { key: "trade", label: "Gewerk" },
  { key: "storey", label: "Geschoss" },
  { key: "room", label: "Raum" },
  { key: "surface", label: "Fläche" },
  { key: "height", label: "Höhe (mm)", numeric: true },
  { key: "status", label: "Status" },
  { key: "connection", label: "Anschluss im Verteiler" },
];

export interface DeviceRow extends Row<DeviceColumn> {
  connected: boolean;
}

export function deviceRows(project: Project): DeviceRow[] {
  const ctx = reportContext(project);
  const rows = project.devices
    .filter((d) => d.placement.kind !== "board")
    .map((d): DeviceRow => {
      const type = typeOf(project, d);
      const room = deviceRoom(project, d);
      const p = d.placement;
      const surface =
        p.kind === "free"
          ? "frei"
          : p.kind === "surface"
            ? surfaceLabel(ctx, d.storeyId, p.surface, p.u)
            : "";
      const height = p.kind === "surface" && surfaceKind(p.surface) === "wall" ? p.v : null;
      const entries = connectionEntries(project, d);
      return {
        id: d.id,
        select: { kind: "device", id: d.id },
        storeyIds: [d.storeyId],
        roomIds: compact([room?.id]),
        trade: type?.trade,
        status: d.status,
        connected: entries.length > 0,
        cells: {
          label: text(d.label),
          type: text(type?.name ?? d.typeId),
          trade: text(type ? TRADE_LABELS[type.trade] : null),
          storey: storeyCell(ctx, d.storeyId),
          room: text(room?.name),
          surface: text(surface),
          height: num(height),
          status: text(STATUS_LABELS[d.status]),
          connection: text(entries.length > 0 ? entries.join("; ") : NOT_CONNECTED),
        },
      };
    });
  return sortBy(rows, ["storey", "room", "label"]);
}

// --- Stromkreise ---

export type CircuitColumn = "board" | "label" | "protection" | "lineType" | "devices" | "rooms";

export const CIRCUIT_COLUMNS: Column<CircuitColumn>[] = [
  { key: "board", label: "Verteiler" },
  { key: "label", label: "Bezeichnung" },
  { key: "protection", label: "Schutzgerät" },
  { key: "lineType", label: "Leitungstyp" },
  { key: "devices", label: "Geräte", numeric: true },
  { key: "rooms", label: "Räume" },
];

export interface CircuitRow extends Row<CircuitColumn> {
  boardId: string;
}

export function circuitRows(project: Project): CircuitRow[] {
  const rows = project.circuits.map((c): CircuitRow => {
    const board = project.boards.find((b) => b.id === c.boardId);
    const devices = circuitDevices(project, c.id);
    const rooms = [...new Set(compact(devices.map((d) => deviceRoom(project, d)?.name)))].sort(
      (a, b) => a.localeCompare(b, "de"),
    );
    return {
      id: c.id,
      select: { kind: "circuit", id: c.id },
      boardId: c.boardId,
      storeyIds: [...new Set(compact([board?.storeyId, ...devices.map((d) => d.storeyId)]))],
      cells: {
        board: text(board?.label ?? "?"),
        label: text(c.label),
        protection: text(project.devices.find((d) => d.id === c.protectionDeviceId)?.label),
        lineType: text(project.catalog.lineTypes.find((t) => t.id === c.lineTypeId)?.name),
        devices: num(devices.length),
        rooms: text(rooms.join(", ")),
      },
    };
  });
  return sortBy(rows, ["board", "label"]);
}

// --- KNX-Kanäle ---

export type KnxColumn = "board" | "actuator" | "channel" | "function" | "consumer" | "room";

export const KNX_COLUMNS: Column<KnxColumn>[] = [
  { key: "board", label: "Verteiler" },
  { key: "actuator", label: "Aktor" },
  { key: "channel", label: "Kanal" },
  { key: "function", label: "Funktion" },
  { key: "consumer", label: "Verbraucher" },
  { key: "room", label: "Raum" },
];

export interface KnxRow extends Row<KnxColumn> {
  boardId: string;
  free: boolean;
}

export const FREE_CHANNEL = "frei";

export function knxRows(project: Project): KnxRow[] {
  const rows: KnxRow[] = [];
  for (const actuator of project.devices) {
    const provides = actuatorProvides(project, actuator);
    if (!provides || actuator.placement.kind !== "board") continue;
    const boardId = actuator.placement.boardId;
    const board = project.boards.find((b) => b.id === boardId);
    for (let ch = 1; ch <= provides.channels; ch++) {
      const a = project.knxAssignments.find(
        (x) => x.actuatorDeviceId === actuator.id && x.channel === ch,
      );
      const consumer = a && project.devices.find((d) => d.id === a.consumerDeviceId);
      const label = channelLabel(actuator.label, ch);
      rows.push({
        id: `${actuator.id}:${ch}`,
        select: consumer
          ? { kind: "device", id: consumer.id }
          : { kind: "device", id: actuator.id },
        boardId,
        free: !consumer,
        storeyIds: compact([board?.storeyId]),
        status: actuator.status,
        cells: {
          board: text(board?.label ?? "?"),
          actuator: text(actuator.label),
          channel: { text: label.slice(actuator.label.length + 1), sort: ch },
          function: text(KNX_FUNCTION_LABELS[provides.function]),
          consumer: text(consumer ? consumer.label : FREE_CHANNEL),
          room: text(consumer ? deviceRoom(project, consumer)?.name : null),
        },
      });
    }
  }
  return sortBy(rows, ["board", "actuator", "channel"]);
}

export function knxSummary(rows: readonly KnxRow[]): string {
  const free = rows.filter((r) => r.free).length;
  return `${rows.length - free} Zuordnungen, ${free} freie Kanäle`;
}

// --- Leitungen ---

export type CableColumn = "label" | "type" | "from" | "to" | "circuit" | "length" | "status";

export const CABLE_COLUMNS: Column<CableColumn>[] = [
  { key: "label", label: "Bezeichnung" },
  { key: "type", label: "Typ" },
  { key: "from", label: "Von" },
  { key: "to", label: "Nach" },
  { key: "circuit", label: "Stromkreis" },
  { key: "length", label: "Länge (m)", numeric: true },
  { key: "status", label: "Status" },
];

export interface CableRow extends Row<CableColumn> {
  lineTypeId: string;
  lengthMm: number | null;
}

export function cableRows(project: Project): CableRow[] {
  const ctx = reportContext(project);
  const rows = project.cables.map((c): CableRow => {
    const type = project.catalog.lineTypes.find((t) => t.id === c.lineTypeId);
    const a = endpointPlace(ctx, c.from);
    const b = endpointPlace(ctx, c.to);
    const length = cableLength(project, c);
    return {
      id: c.id,
      select: { kind: "cable", id: c.id },
      lineTypeId: c.lineTypeId,
      lengthMm: length,
      storeyIds: [...new Set(compact([a.storeyId, b.storeyId]))],
      roomIds: [...new Set(compact([a.roomId, b.roomId]))],
      trade: lineTypeTrade(project, c),
      status: c.status,
      cells: {
        label: text(c.label),
        type: text(type?.name ?? c.lineTypeId),
        from: text(endpointLabel(project, c.from)),
        to: text(endpointLabel(project, c.to)),
        circuit: text(cableCircuit(project, c)?.label),
        length: length === null ? { text: "–", sort: null } : num(length, formatMeters(length)),
        status: text(STATUS_LABELS[c.status]),
      },
    };
  });
  return sortBy(rows, ["type", "label"]);
}

export interface CableTotal {
  lineTypeId: string;
  name: string;
  count: number;
  lengthMm: number;
  withoutPath: number;
}

/** Summen je Leitungstyp der (gefilterten) Zeilen, nach Name. */
export function cableTotals(project: Project, rows: readonly CableRow[]): CableTotal[] {
  const by = new Map<string, CableTotal>();
  for (const r of rows) {
    let t = by.get(r.lineTypeId);
    if (!t) {
      const name =
        project.catalog.lineTypes.find((x) => x.id === r.lineTypeId)?.name ?? r.lineTypeId;
      by.set(
        r.lineTypeId,
        (t = { lineTypeId: r.lineTypeId, name, count: 0, lengthMm: 0, withoutPath: 0 }),
      );
    }
    t.count++;
    if (r.lengthMm === null) t.withoutPath++;
    else t.lengthMm += r.lengthMm;
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
}

export function cableTotalText(t: CableTotal): string {
  return `${t.name}: ${t.count} ${t.count === 1 ? "Leitung" : "Leitungen"}, ${formatMeters(t.lengthMm)} m${t.withoutPath > 0 ? `, ${t.withoutPath} ohne Weg` : ""}`;
}

// --- Durchbrüche ---

export type PenetrationColumn =
  "storey" | "room" | "part" | "position" | "method" | "diameter" | "cables";

export const PENETRATION_COLUMNS: Column<PenetrationColumn>[] = [
  { key: "storey", label: "Geschoss" },
  { key: "room", label: "Raum" },
  { key: "part", label: "Bauteil" },
  { key: "position", label: "Lage" },
  { key: "method", label: "Art" },
  { key: "diameter", label: "Durchmesser (mm)", numeric: true },
  { key: "cables", label: "Leitungen" },
];

export interface PenetrationRow extends Row<PenetrationColumn> {
  method: NonNullable<RouteSegment["penetration"]>["method"];
}

export function penetrationRows(project: Project): PenetrationRow[] {
  const ctx = reportContext(project);
  const rows: PenetrationRow[] = [];
  for (const seg of project.routeSegments) {
    if (seg.kind !== "penetration" || !seg.penetration) continue;
    const node = project.routeNodes.find((n) => n.id === seg.a);
    const anchor = node?.anchors[0];
    let room: Room | null = null;
    let part = "";
    let position = "";
    if (anchor && node) {
      const kind = surfaceKind(anchor.surface);
      if (kind === "wall") {
        room = wallRoom(ctx, node.storeyId, anchor.surface, anchor.u);
        const view = room && roomViewAt(ctx, room.id, anchor.surface, anchor.u);
        const wall = project.walls.find((w) => w.id === anchor.surface.split(":")[1]);
        const name = view?.name ?? surfaceLabel(ctx, node.storeyId, anchor.surface, anchor.u);
        part = `Wand ${name}${wall ? ` (${wall.thicknessMm} mm)` : ""}`;
        const from = view ? anchor.u - view.finished.uFrom : anchor.u;
        position = `${Math.round(from)} / ${Math.round(anchor.v)}`;
      } else {
        const roomId = anchor.surface.split(":")[1];
        room = project.rooms.find((r) => r.id === roomId) ?? null;
        part = surfaceLabel(ctx, node.storeyId, anchor.surface, anchor.u);
        const x = kind === "ceiling" ? -anchor.u : anchor.u;
        position =
          kind === "slope"
            ? `${Math.round(anchor.u)} / ${Math.round(anchor.v)}`
            : `x ${Math.round(x)} / y ${Math.round(anchor.v)}`;
      }
    }
    const cables = project.cables
      .filter((c) => c.path?.includes(seg.id))
      .map((c) => c.label)
      .sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
    rows.push({
      id: seg.id,
      select: { kind: "route-segment", id: seg.id },
      method: seg.penetration.method,
      storeyIds: [seg.storeyId],
      roomIds: compact([room?.id]),
      status: seg.status,
      cells: {
        storey: storeyCell(ctx, seg.storeyId),
        room: text(room?.name),
        part: text(part),
        position: text(position),
        method: text(PENETRATION_LABELS[seg.penetration.method]),
        diameter: num(seg.penetration.diameterMm),
        cables: text(cables.join(", ")),
      },
    });
  }
  return sortBy(rows, ["storey", "room", "method"]);
}

/** Länge eines Trassensegments in mm (für Leerrohre). */
export function segmentLength(project: Project, segmentId: string): number {
  return routeGraph(project).lengths.get(segmentId) ?? 0;
}
