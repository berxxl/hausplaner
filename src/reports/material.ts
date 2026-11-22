/**
 * Materialliste (design.md M5 „Die Listen im Einzelnen“, Material): Geräte je Typ, Unterputzdosen
 * je Tiefe mit Kombinationen, Leitungen je Typ, Leerrohre je Nenngröße, Reiheneinbaugeräte. Frei
 * von React.
 */
import { routeGraph } from "../geometry/cables";
import { deviceRoom } from "../geometry/circuits";
import { deviceTeWidth } from "../geometry/boards";
import { surfaceKind } from "../model/devices";
import type { Device, Project } from "../model/types";
import { TRADE_LABELS } from "../ui/labels";
import { cableRows, cableTotals } from "./rows";
import {
  filterRows,
  formatMeters,
  num,
  text,
  type Column,
  type Row,
  type RowFilter,
} from "./filter";

export interface MaterialSection {
  title: string;
  columns: Column[];
  rows: Row[];
}

/** Toleranz und Achsabstand von Kombinationen (design.md M2 „Kombinationen“). */
const COMBINATION_PITCH_MM = 71;
const COMBINATION_TOLERANCE_MM = 2;

const typeOf = (project: Project, d: Device) =>
  project.catalog.deviceTypes.find((t) => t.id === d.typeId);

/** Geräte als filterbare Zeilen (ohne Zellen), um denselben Filter wie die Listen zu nutzen. */
function deviceFilterRow(project: Project, d: Device): Row & { device: Device } {
  const p = d.placement;
  const boardStorey =
    p.kind === "board" ? project.boards.find((b) => b.id === p.boardId)?.storeyId : undefined;
  return {
    id: d.id,
    device: d,
    storeyIds: [boardStorey ?? d.storeyId],
    roomIds:
      d.placement.kind === "board"
        ? undefined
        : [deviceRoom(project, d)?.id].filter((x): x is string => !!x),
    trade: typeOf(project, d)?.trade,
    status: d.status,
    cells: {},
  };
}

/** Kombinationen: Ketten im 71-mm-Raster auf derselben Fläche; Anzahl je Kettenlänge n ≥ 2. */
export function combinations(project: Project, devices: readonly Device[]): Map<number, number> {
  const bySurface = new Map<string, { id: string; u: number; v: number }[]>();
  for (const d of devices) {
    const p = d.placement;
    if (p.kind !== "surface" || surfaceKind(p.surface) === "floor") continue;
    if (!typeOf(project, d)?.flush) continue;
    const list = bySurface.get(p.surface) ?? [];
    list.push({ id: d.id, u: p.u, v: p.v });
    bySurface.set(p.surface, list);
  }
  const near = (a: number, b: number) => Math.abs(a - b) <= COMBINATION_TOLERANCE_MM;
  const result = new Map<number, number>();
  for (const list of bySurface.values()) {
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const du = Math.abs(a.u - b.u);
        const dv = Math.abs(a.v - b.v);
        const linked =
          (near(dv, 0) && near(du, COMBINATION_PITCH_MM)) ||
          (near(du, 0) && near(dv, COMBINATION_PITCH_MM));
        if (linked) parent[find(i)] = find(j);
      }
    const sizes = new Map<number, number>();
    list.forEach((_, i) => sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1));
    for (const n of sizes.values()) if (n >= 2) result.set(n, (result.get(n) ?? 0) + 1);
  }
  return result;
}

const plainRow = (id: string, cells: Row["cells"]): Row => ({ id, cells });

export function materialList(project: Project, filter: RowFilter): MaterialSection[] {
  const all = project.devices.map((d) => deviceFilterRow(project, d));
  const devices = filterRows(
    all.filter((r) => r.device.placement.kind !== "board"),
    filter,
  ).map((r) => r.device);
  const boardDevices = filterRows(
    all.filter((r) => r.device.placement.kind === "board"),
    { ...filter, roomId: null },
  ).map((r) => r.device);

  // 1. Geräte je Typ
  const byType = new Map<string, number>();
  for (const d of devices) byType.set(d.typeId, (byType.get(d.typeId) ?? 0) + 1);
  const typeRows = [...byType]
    .map(([typeId, n]) => {
      const t = project.catalog.deviceTypes.find((x) => x.id === typeId);
      return plainRow(typeId, {
        type: text(t?.name ?? typeId),
        trade: text(t ? TRADE_LABELS[t.trade] : null),
        count: num(n),
      });
    })
    .sort((a, b) => a.cells.type!.text.localeCompare(b.cells.type!.text, "de"));

  // 2. Unterputzdosen je Tiefe und Kombinationen
  const boxed = devices.filter((d) => {
    const p = d.placement;
    return (
      p.kind === "surface" && surfaceKind(p.surface) !== "floor" && !!typeOf(project, d)?.flush
    );
  });
  const byDepth = new Map<number, number>();
  for (const d of boxed) {
    const depth = typeOf(project, d)!.flush!.boxDepthMm;
    byDepth.set(depth, (byDepth.get(depth) ?? 0) + 1);
  }
  const boxRows = [...byDepth]
    .sort((a, b) => a[0] - b[0])
    .map(([depth, n]) =>
      plainRow(`box:${depth}`, { item: text(`Gerätedose ${depth} mm`), count: num(n) }),
    );
  for (const [n, count] of [...combinations(project, boxed)].sort((a, b) => a[0] - b[0]))
    boxRows.push(
      plainRow(`combination:${n}`, { item: text(`Kombination ${n}-fach`), count: num(count) }),
    );

  // 3. Leitungen je Typ
  const cableTotalsRows = cableTotals(project, filterRows(cableRows(project), filter)).map((t) =>
    plainRow(t.lineTypeId, {
      type: text(t.name),
      count: num(t.count),
      length: num(t.lengthMm, formatMeters(t.lengthMm)),
      withoutPath: num(t.withoutPath || null),
    }),
  );

  // 4. Leerrohre je Nenngröße (Trassensegmente mit Leerrohr)
  const lengths = routeGraph(project).lengths;
  const conduitRows: Row[] = project.routeSegments
    .filter((s) => s.conduit)
    .map((s) => {
      const roomId = s.surface?.startsWith("wall:") ? undefined : s.surface?.split(":")[1];
      return {
        id: s.id,
        storeyIds: [s.storeyId],
        roomIds: roomId ? [roomId] : undefined,
        trade: "conduit" as const,
        status: s.status,
        cells: { size: text(s.conduit!.size), length: num(lengths.get(s.id) ?? 0) },
      };
    });
  const bySize = new Map<string, number>();
  for (const r of filterRows(conduitRows, filter))
    bySize.set(
      r.cells.size!.text,
      (bySize.get(r.cells.size!.text) ?? 0) + (r.cells.length!.sort as number),
    );
  const sizeRows = [...bySize]
    .sort((a, b) => a[0].localeCompare(b[0], "de", { numeric: true }))
    .map(([size, mm]) =>
      plainRow(`conduit:${size}`, { size: text(size), length: num(mm, formatMeters(mm)) }),
    );

  // 5. Reiheneinbaugeräte je Typ
  const byRail = new Map<string, number>();
  for (const d of boardDevices) byRail.set(d.typeId, (byRail.get(d.typeId) ?? 0) + 1);
  const railRows = [...byRail]
    .map(([typeId, n]) => {
      const t = project.catalog.deviceTypes.find((x) => x.id === typeId);
      return plainRow(`rail:${typeId}`, {
        type: text(t?.name ?? typeId),
        count: num(n),
        te: num(Math.ceil(deviceTeWidth(t) * n * 10) / 10),
      });
    })
    .sort((a, b) => a.cells.type!.text.localeCompare(b.cells.type!.text, "de"));

  return [
    {
      title: "Geräte je Typ",
      columns: [
        { key: "type", label: "Typ" },
        { key: "trade", label: "Gewerk" },
        { key: "count", label: "Anzahl", numeric: true },
      ],
      rows: typeRows,
    },
    {
      title: "Unterputzdosen",
      columns: [
        { key: "item", label: "Dose" },
        { key: "count", label: "Anzahl", numeric: true },
      ],
      rows: boxRows,
    },
    {
      title: "Leitungen je Typ",
      columns: [
        { key: "type", label: "Typ" },
        { key: "count", label: "Anzahl", numeric: true },
        { key: "length", label: "Länge (m)", numeric: true },
        { key: "withoutPath", label: "ohne Weg", numeric: true },
      ],
      rows: cableTotalsRows,
    },
    {
      title: "Leerrohre je Nenngröße",
      columns: [
        { key: "size", label: "Nenngröße" },
        { key: "length", label: "Länge (m)", numeric: true },
      ],
      rows: sizeRows,
    },
    {
      title: "Reiheneinbaugeräte",
      columns: [
        { key: "type", label: "Typ" },
        { key: "count", label: "Anzahl", numeric: true },
        { key: "te", label: "TE", numeric: true },
      ],
      rows: railRows,
    },
  ];
}
