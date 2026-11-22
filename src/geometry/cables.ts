/**
 * Leitungen im Trassennetz (design.md M3 „Leitungen“, „Leerrohre“): Graph, Wegvorschlag,
 * Kette ordnen, Länge, Belegung. Frei von React.
 */
import { segmentLength } from "./routes";
import { boardConnects } from "./boards";
import type {
  Cable,
  Endpoint,
  LineType,
  Project,
  RouteNode,
  RouteSegment,
  Trade,
} from "../model/types";

/** Füllgrad, ab dem ein Leerrohr als überfüllt gilt. */
export const CONDUIT_FILL_LIMIT = 0.4;

/** Flexibles Wellrohr nach DIN EN 61386-22, übliche Innendurchmesser (design.md M3 „Leerrohre“). */
export const CONDUIT_SIZES: readonly { size: string; innerDiameterMm: number }[] = [
  { size: "M16", innerDiameterMm: 10.7 },
  { size: "M20", innerDiameterMm: 14.1 },
  { size: "M25", innerDiameterMm: 18.3 },
  { size: "M32", innerDiameterMm: 24.3 },
  { size: "M40", innerDiameterMm: 31.2 },
  { size: "M50", innerDiameterMm: 39.6 },
];

interface Edge {
  segment: string;
  other: string;
  length: number;
}

export interface RouteGraph {
  nodes: Map<string, RouteNode>;
  segments: Map<string, RouteSegment>;
  lengths: Map<string, number>;
  adjacency: Map<string, Edge[]>;
}

const cache = new WeakMap<Project, RouteGraph>();

/** Ungerichteter Graph aller Segmente mit bekannter Länge. */
export function routeGraph(project: Project): RouteGraph {
  const hit = cache.get(project);
  if (hit) return hit;
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  const segments = new Map(project.routeSegments.map((s) => [s.id, s]));
  const lengths = new Map<string, number>();
  const adjacency = new Map<string, Edge[]>();
  const add = (from: string, e: Edge) => {
    const list = adjacency.get(from);
    if (list) list.push(e);
    else adjacency.set(from, [e]);
  };
  for (const s of project.routeSegments) {
    const length = segmentLength(project, s, nodes);
    if (length === null) continue;
    lengths.set(s.id, length);
    add(s.a, { segment: s.id, other: s.b, length });
    add(s.b, { segment: s.id, other: s.a, length });
  }
  const graph = { nodes, segments, lengths, adjacency };
  cache.set(project, graph);
  return graph;
}

/** Knoten eines Endpunkts: Gerätknoten des Geräts bzw. Verteilerknoten des Verteilers (M4). */
export function isEndpointNode(node: RouteNode | undefined, ep: Endpoint): boolean {
  if (!node) return false;
  return ep.deviceId !== undefined ? node.deviceId === ep.deviceId : node.boardId === ep.boardId;
}

const endpointNodes = (g: RouteGraph, ep: Endpoint) =>
  [...g.nodes.values()].filter((n) => isEndpointNode(n, ep)).map((n) => n.id);

/** Lexikografischer Vergleich zweier ID-Folgen. */
function compareIds(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i]! < b[i]!) return -1;
    if (a[i]! > b[i]!) return 1;
  }
  return a.length - b.length;
}

const EPS = 1e-6;

/**
 * Kürzester Weg (Dijkstra) zwischen den Knoten zweier Endpunkte (Gerät oder Verteiler); bei
 * gleicher Länge gewinnt die lexikografisch kleinere Folge der Segment-IDs. Leer ohne Weg.
 */
export function suggestPath(project: Project, from: Endpoint, to: Endpoint): string[] {
  const g = routeGraph(project);
  const targets = new Set(endpointNodes(g, to));
  if (targets.size === 0) return [];
  const best = new Map<string, { dist: number; path: string[] }>();
  const open: string[] = [];
  for (const n of endpointNodes(g, from)) {
    best.set(n, { dist: 0, path: [] });
    open.push(n);
  }
  const better = (a: { dist: number; path: string[] }, b: { dist: number; path: string[] }) =>
    a.dist < b.dist - EPS || (Math.abs(a.dist - b.dist) <= EPS && compareIds(a.path, b.path) < 0);
  const done = new Set<string>();
  while (open.length > 0) {
    open.sort((x, y) => (better(best.get(x)!, best.get(y)!) ? -1 : 1));
    const current = open.shift()!;
    if (done.has(current)) continue;
    done.add(current);
    const here = best.get(current)!;
    for (const e of g.adjacency.get(current) ?? []) {
      if (done.has(e.other)) continue;
      const cand = { dist: here.dist + e.length, path: [...here.path, e.segment] };
      const old = best.get(e.other);
      if (!old || better(cand, old)) {
        best.set(e.other, cand);
        open.push(e.other);
      }
    }
  }
  let result: { dist: number; path: string[] } | null = null;
  for (const t of targets) {
    const b = best.get(t);
    if (b && (!result || better(b, result))) result = b;
  }
  return result?.path ?? [];
}

/** Folge der Knoten entlang eines Wegs ab einem Knoten des Startendpunkts; null, wenn unterbrochen. */
function walk(g: RouteGraph, cable: Pick<Cable, "from" | "to">, path: readonly string[]) {
  if (path.length === 0) return null;
  for (const start of endpointNodes(g, cable.from)) {
    let at = start;
    let ok = true;
    for (const id of path) {
      const s = g.segments.get(id);
      if (!s || !g.lengths.has(id)) {
        ok = false;
        break;
      }
      if (s.a === at) at = s.b;
      else if (s.b === at) at = s.a;
      else {
        ok = false;
        break;
      }
    }
    if (ok && isEndpointNode(g.nodes.get(at), cable.to)) return at;
  }
  return null;
}

/** Zusammenhängende Kette vom Gerät `from` zum Gerät `to`? */
export function isPathConnected(project: Project, cable: Pick<Cable, "from" | "to" | "path">) {
  return walk(routeGraph(project), cable, cable.path) !== null;
}

/**
 * Ordnet gewählte Segmente zu einer Kette vom ersten zum zweiten Gerät (design.md M3 „Weg
 * bearbeiten“); null, wenn sich keine Kette aus genau diesen Segmenten bilden lässt.
 */
export function orderChain(
  project: Project,
  cable: Pick<Cable, "from" | "to">,
  segmentIds: readonly string[],
): string[] | null {
  const g = routeGraph(project);
  const set = new Set(segmentIds);
  for (const start of endpointNodes(g, cable.from)) {
    const left = new Set(set);
    const order: string[] = [];
    let at = start;
    for (;;) {
      const next = (g.adjacency.get(at) ?? []).filter((e) => left.has(e.segment));
      if (next.length !== 1) break;
      left.delete(next[0]!.segment);
      order.push(next[0]!.segment);
      at = next[0]!.other;
    }
    if (left.size === 0 && isEndpointNode(g.nodes.get(at), cable.to)) return order;
  }
  return null;
}

/** Summe der Segmentlängen eines zusammenhängenden Wegs in mm, sonst null. */
export function routedLength(project: Project, cable: Cable): number | null {
  const g = routeGraph(project);
  if (walk(g, cable, cable.path) === null) return null;
  return cable.path.reduce((sum, id) => sum + g.lengths.get(id)!, 0);
}

/**
 * Leitungslänge mit Zuschlägen in mm: (Trasse + Zuschlag je Geräte- bzw. Verteilerendpunkt)
 * · (1 + Verschnitt) (design.md M4 „Verteiler als Endpunkt“).
 */
export function cableLength(project: Project, cable: Cable): number | null {
  const routed = routedLength(project, cable);
  if (routed === null) return null;
  const { perDeviceMm, perBoardMm, wastePercent } = project.settings.lengthAllowance;
  const allowance = (ep: Endpoint) => (ep.boardId !== undefined ? perBoardMm : perDeviceMm);
  return (routed + allowance(cable.from) + allowance(cable.to)) * (1 + wastePercent / 100);
}

/** Länge in m mit einer Nachkommastelle und Komma: „9,9 m“; ohne Weg „–“. */
export function formatCableLength(mm: number | null): string {
  if (mm === null) return "–";
  return `${(Math.round(mm / 100) / 10).toFixed(1).replace(".", ",")} m`;
}

/** Gewerke, die ein Endpunkt anschließt: `connects` des Gerätetyps bzw. nach Verteilerart. */
export function endpointTrades(project: Project, ep: Endpoint): readonly Trade[] {
  if (ep.boardId !== undefined) {
    const board = project.boards.find((b) => b.id === ep.boardId);
    return board ? boardConnects(board.kind) : [];
  }
  const d = project.devices.find((x) => x.id === ep.deviceId);
  return project.catalog.deviceTypes.find((t) => t.id === d?.typeId)?.connects ?? [];
}

/** Bezeichnung eines Endpunkts (Gerät oder Verteiler); „?“ bei Verweis ins Leere. */
export function endpointLabel(project: Project, ep: Endpoint): string {
  if (ep.boardId !== undefined)
    return project.boards.find((b) => b.id === ep.boardId)?.label ?? "?";
  return project.devices.find((d) => d.id === ep.deviceId)?.label ?? "?";
}

/** Gibt es den Endpunkt im Projekt? */
export function endpointExists(project: Project, ep: Endpoint): boolean {
  return ep.boardId !== undefined
    ? project.boards.some((b) => b.id === ep.boardId)
    : project.devices.some((d) => d.id === ep.deviceId);
}

export const sameEndpoint = (a: Endpoint, b: Endpoint) =>
  a.deviceId === b.deviceId && a.boardId === b.boardId;

/** Leitungstypen, deren Gewerk beide Endpunkte anschließen. */
export function compatibleLineTypes(project: Project, a: Endpoint, b: Endpoint): LineType[] {
  const ta = endpointTrades(project, a);
  const tb = endpointTrades(project, b);
  return project.catalog.lineTypes.filter((t) => ta.includes(t.trade) && tb.includes(t.trade));
}

export interface Occupancy {
  cables: Cable[];
  /** Summe der Querschnitte in mm² */
  areaMm2: number;
  /** Innenquerschnitt des Leerrohrs in mm², null ohne Leerrohr */
  conduitAreaMm2: number | null;
  /** Füllgrad 0..n, null ohne Leerrohr */
  fill: number | null;
}

const circle = (d: number) => Math.PI * (d / 2) ** 2;

/** Leitungen, Querschnittssumme und Füllgrad eines Segments (design.md M3 „Leerrohre“). */
export function occupancy(project: Project, segmentId: string): Occupancy {
  const seg = project.routeSegments.find((s) => s.id === segmentId);
  const cables = project.cables.filter((c) => c.path.includes(segmentId));
  const areaMm2 = cables.reduce((sum, c) => {
    const t = project.catalog.lineTypes.find((x) => x.id === c.lineTypeId);
    return sum + (t ? circle(t.outerDiameterMm) : 0);
  }, 0);
  const inner =
    seg?.conduit?.innerDiameterMm ??
    (seg?.penetration?.method === "conduit" ? seg.penetration.diameterMm : undefined);
  const conduitAreaMm2 = inner ? circle(inner) : null;
  return {
    cables,
    areaMm2,
    conduitAreaMm2,
    fill: conduitAreaMm2 ? areaMm2 / conduitAreaMm2 : null,
  };
}
