/**
 * Klimaverbindungen (design.md M6 „Klimaverbindung“, „Kondensatgefälle“): Innen- und Außengerät,
 * Kältemittel- und Kondensatleitungen, Mehrlänge, Gefälle je Segment. Nichts davon wird
 * gespeichert. Frei von React.
 */
import { cableLength, pathNodes } from "./cables";
import { segmentWorldEnds } from "./routes";
import { refrigerantUnit } from "../model/devices";
import type { Cable, Device, Endpoint, Project, Trade } from "../model/types";

export interface RefrigerantLimits {
  minLengthM: number;
  maxLengthM: number;
  prechargedLengthM: number;
}

export interface RefrigerantLink {
  cableId: string;
  indoorId: string;
  outdoorId: string;
  /** Angezeigte Länge mit Zuschlägen in mm, null ohne Weg */
  lengthMm: number | null;
  /** Grenzen aus dem Typ des Außengeräts */
  limits: RefrigerantLimits | null;
  /** Länge über der vorgefüllten Länge in mm (≥ 0), null ohne Weg oder ohne Grenzen */
  extraLengthMm: number | null;
}

export interface CondensateLink {
  cableId: string;
  /** Anderes Ende (Ablauf) */
  drain: Endpoint;
  lengthMm: number | null;
}

export type AcUnit = "indoor" | "outdoor";

const tradeOf = (project: Project, cable: Cable): Trade | undefined =>
  project.catalog.lineTypes.find((t) => t.id === cable.lineTypeId)?.trade;

export const isRefrigerantCable = (project: Project, cable: Cable) =>
  tradeOf(project, cable) === "refrigerant";
export const isCondensateCable = (project: Project, cable: Cable) =>
  tradeOf(project, cable) === "condensate";

function deviceOf(project: Project, ep: Endpoint): Device | undefined {
  return ep.deviceId !== undefined ? project.devices.find((d) => d.id === ep.deviceId) : undefined;
}

/** Rolle eines Geräts als Klimagerät; null, wenn es keins ist. */
export function acUnitOf(project: Project, device: Device | undefined): AcUnit | null {
  if (!device) return null;
  return refrigerantUnit(project.catalog.deviceTypes.find((t) => t.id === device.typeId));
}

const endpointUnit = (project: Project, ep: Endpoint) => acUnitOf(project, deviceOf(project, ep));

/** Innen- und Außengerät einer Kältemittelleitung, null, wenn sie nicht genau beide verbindet. */
export function refrigerantEnds(
  project: Project,
  cable: Cable,
): { indoorId: string; outdoorId: string } | null {
  const a = endpointUnit(project, cable.from);
  const b = endpointUnit(project, cable.to);
  if (a === "indoor" && b === "outdoor")
    return { indoorId: cable.from.deviceId!, outdoorId: cable.to.deviceId! };
  if (a === "outdoor" && b === "indoor")
    return { indoorId: cable.to.deviceId!, outdoorId: cable.from.deviceId! };
  return null;
}

/** Eine Verbindung je Kältemittelleitung zwischen Innen- und Außengerät. */
export function refrigerantLinks(project: Project): RefrigerantLink[] {
  const links: RefrigerantLink[] = [];
  for (const cable of project.cables) {
    if (!isRefrigerantCable(project, cable)) continue;
    const ends = refrigerantEnds(project, cable);
    if (!ends) continue;
    const outdoor = project.devices.find((d) => d.id === ends.outdoorId)!;
    const r = project.catalog.deviceTypes.find((t) => t.id === outdoor.typeId)?.refrigerant;
    const limits = r
      ? {
          minLengthM: r.minLengthM,
          maxLengthM: r.maxLengthM,
          prechargedLengthM: r.prechargedLengthM,
        }
      : null;
    const lengthMm = cableLength(project, cable);
    const extraLengthMm =
      lengthMm === null || !limits ? null : Math.max(0, lengthMm - limits.prechargedLengthM * 1000);
    links.push({ cableId: cable.id, ...ends, lengthMm, limits, extraLengthMm });
  }
  return links;
}

/** Kondensatleitungen eines Innengeräts mit dem anderen Ende als Ablauf. */
export function condensateLinks(project: Project, indoorId: string): CondensateLink[] {
  return project.cables
    .filter((c) => isCondensateCable(project, c))
    .filter((c) => c.from.deviceId === indoorId || c.to.deviceId === indoorId)
    .map((c) => ({
      cableId: c.id,
      drain: c.from.deviceId === indoorId ? c.to : c.from,
      lengthMm: cableLength(project, c),
    }));
}

export interface AcConnection {
  unit: AcUnit;
  links: RefrigerantLink[];
  /** nur beim Innengerät */
  condensate: CondensateLink[];
}

/** Klimaverbindung eines Innen- oder Außengeräts; null, wenn das Gerät keins ist. */
export function acConnection(project: Project, deviceId: string): AcConnection | null {
  const unit = acUnitOf(
    project,
    project.devices.find((d) => d.id === deviceId),
  );
  if (!unit) return null;
  const links = refrigerantLinks(project).filter((l) =>
    unit === "indoor" ? l.indoorId === deviceId : l.outdoorId === deviceId,
  );
  return { unit, links, condensate: unit === "indoor" ? condensateLinks(project, deviceId) : [] };
}

export interface SegmentSlope {
  segmentId: string;
  /** Gefälle in % (positiv = fällt in Fließrichtung); null bei senkrechtem Segment */
  percent: number | null;
  /** Fall in mm in Fließrichtung (z_ein − z_aus) */
  dropMm: number;
  /** waagerechter Abstand in mm */
  horizontalMm: number;
  /** Steigt das Segment an oder hat es zu wenig Gefälle? */
  ok: boolean;
}

/** Rundungstoleranz der ganzzahligen Anker in mm. */
const SLOPE_TOLERANCE_MM = 0.5;

/**
 * Gefälle je Segment einer Kondensatleitung in Fließrichtung vom Innengerät weg (ist keins der
 * Enden ein Innengerät: von `from` nach `to`); null ohne zusammenhängenden Weg.
 */
export function condensateSlopes(project: Project, cable: Cable): SegmentSlope[] | null {
  const reversed =
    endpointUnit(project, cable.to) === "indoor" && endpointUnit(project, cable.from) !== "indoor";
  const nodesFrom = pathNodes(project, cable);
  if (!nodesFrom) return null;
  const order = reversed ? [...nodesFrom].reverse() : nodesFrom;
  const path = reversed ? [...cable.path].reverse() : cable.path;
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  const segments = new Map(project.routeSegments.map((s) => [s.id, s]));
  const min = project.settings.condensateMinSlopePercent;
  const result: SegmentSlope[] = [];
  path.forEach((id, i) => {
    const seg = segments.get(id)!;
    const ends = segmentWorldEnds(project, seg, nodes);
    if (!ends) return;
    const fromA = seg.a === order[i];
    const zIn = fromA ? ends.za : ends.zb;
    const zOut = fromA ? ends.zb : ends.za;
    const horizontalMm = Math.hypot(ends.b.x - ends.a.x, ends.b.y - ends.a.y);
    const dropMm = zIn - zOut;
    if (horizontalMm < 1) {
      if (dropMm === 0) return;
      result.push({ segmentId: id, percent: null, dropMm, horizontalMm, ok: dropMm > 0 });
      return;
    }
    const percent = (dropMm / horizontalMm) * 100;
    const ok = dropMm >= (min * horizontalMm) / 100 - SLOPE_TOLERANCE_MM;
    result.push({ segmentId: id, percent, dropMm, horizontalMm, ok });
  });
  return result;
}

/** Gefälle in % mit einer Nachkommastelle und Komma: „1,5 %“. */
export function formatSlope(percent: number): string {
  return `${(Math.round(percent * 10) / 10).toFixed(1).replace(".", ",")} %`;
}

/** Meter mit einer Nachkommastelle und Komma: „2,5 m“. */
export function formatMeters(mm: number): string {
  return `${(Math.round(mm / 100) / 10).toFixed(1).replace(".", ",")} m`;
}

/** „Mehrlänge: 2,5 m (vorgefüllt 7 m)“ bzw. „keine Mehrlänge“; null ohne Grenzen. */
export function extraLengthText(link: RefrigerantLink): string | null {
  if (!link.limits) return null;
  const pre = `${String(link.limits.prechargedLengthM).replace(".", ",")} m`;
  if (link.lengthMm === null) return "Länge unbekannt (Leitung ohne Weg)";
  return link.extraLengthMm! > 0
    ? `Mehrlänge: ${formatMeters(link.extraLengthMm!)} (vorgefüllt ${pre})`
    : `keine Mehrlänge (vorgefüllt ${pre})`;
}
