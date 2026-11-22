/**
 * Fang des Werkzeugs „Trasse“ in der Flächenansicht (design.md M3 „Trassen zeichnen“): Gerätemitte,
 * bestehender Knoten, Punkt auf einem Segment, Kante der Fläche, Winkelfang. Koordinaten der
 * Ansicht: u wie die Fläche, v wie angezeigt (ganze Wandseite: über Rohfußboden). Frei von React.
 */
import { fromPath, offset, toPath } from "../../geometry/clipper";
import { anchorOn, edgeAnchors, projectOntoSegment, roomViewAt } from "../../geometry/routes";
import type { Anchor, Project } from "../../model/types";
import type { SurfaceModel, UV } from "./model";

/** Fangradius in Bildschirmpixeln. */
export const ROUTE_SNAP_PX = 12;

export type RouteSnap =
  | { kind: "device"; at: UV; deviceId: string }
  | { kind: "node"; at: UV; nodeId: string }
  | { kind: "segment"; at: UV; segmentId: string }
  | { kind: "edge"; at: UV }
  | { kind: "free"; at: UV };

/** Versatz von v zwischen Anker (über OKFF) und Ansicht: ganze Wandseite zeigt Rohbauhöhen. */
export function viewDv(project: Project, model: SurfaceModel, u: number): number {
  if (model.kind !== "wall-side") return 0;
  return roomViewAt(project, model.ref, u)?.floorBuildupMm ?? 0;
}

export const anchorToView = (project: Project, model: SurfaceModel, a: Anchor): UV => ({
  u: a.u,
  v: a.v + viewDv(project, model, a.u),
});

export const viewToAnchor = (project: Project, model: SurfaceModel, p: UV): Anchor => ({
  surface: model.ref,
  u: Math.round(p.u) || 0,
  v: Math.round(p.v - viewDv(project, model, p.u)) || 0,
});

/** Kanten, an denen Übergänge entstehen können: fertige Kontur der Raumansicht bzw. von Decke/Boden. */
export function edgeContour(project: Project, model: SurfaceModel): UV[] {
  if (model.kind === "room-wall") return model.contour;
  if (model.kind !== "ceiling" && model.kind !== "floor") return [];
  const roomId = model.ref.split(":")[1];
  const room = project.rooms.find((r) => r.id === roomId);
  const storey = room && project.storeys.find((s) => s.id === room.storeyId);
  if (!room || !storey) return [];
  const plaster = room.plasterMm ?? storey.defaults.plasterMm;
  const finished =
    plaster > 0 ? offset([toPath(room.polygon)], -plaster).map(fromPath)[0] : room.polygon;
  const mirror = model.kind === "ceiling";
  return (finished ?? []).map((p) => ({ u: mirror ? -p.x : p.x, v: p.y }));
}

function projectOnPolyline(ring: readonly UV[], p: UV): { at: UV; d: number } | null {
  let best: { at: UV; d: number } | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const du = b.u - a.u;
    const dv = b.v - a.v;
    const len2 = du * du + dv * dv;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.u - a.u) * du + (p.v - a.v) * dv) / len2));
    const at = { u: a.u + t * du, v: a.v + t * dv };
    const d = Math.hypot(at.u - p.u, at.v - p.v);
    if (!best || d < best.d) best = { at, d };
  }
  return best;
}

/** Winkelfang 0°/90° zum vorigen Punkt bis 10° Abweichung. */
function angleSnap(p: UV, prev: UV): UV {
  const du = p.u - prev.u;
  const dv = p.v - prev.v;
  const deg = (Math.atan2(Math.abs(dv), Math.abs(du)) * 180) / Math.PI;
  if (deg <= 10) return { u: p.u, v: prev.v };
  if (deg >= 80) return { u: prev.u, v: p.v };
  return p;
}

export function routeSnap(
  project: Project,
  model: SurfaceModel,
  p: UV,
  opts: {
    zoom: number;
    prev?: UV | null;
    noAngle?: boolean;
    /** sichtbare Geräte dieser Ansicht mit Mitte (in Ansichtskoordinaten) */
    devices: { id: string; at: UV }[];
  },
): RouteSnap {
  const r = ROUTE_SNAP_PX / opts.zoom;
  const near = (q: UV) => Math.hypot(q.u - p.u, q.v - p.v);
  let dev: { id: string; at: UV } | null = null;
  for (const d of opts.devices) if (near(d.at) <= r && (!dev || near(d.at) < near(dev.at))) dev = d;
  if (dev) return { kind: "device", at: dev.at, deviceId: dev.id };

  let node: { id: string; at: UV } | null = null;
  for (const n of project.routeNodes) {
    const a = anchorOn(n, model.ref);
    if (!a) continue;
    const at = anchorToView(project, model, a);
    if (near(at) <= r && (!node || near(at) < near(node.at))) node = { id: n.id, at };
  }
  if (node) return { kind: "node", at: node.at, nodeId: node.id };

  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  let seg: { id: string; at: UV; d: number } | null = null;
  for (const s of project.routeSegments) {
    if (s.kind !== "surface" || s.surface !== model.ref) continue;
    const a = nodes.get(s.a) && anchorOn(nodes.get(s.a)!, model.ref);
    const b = nodes.get(s.b) && anchorOn(nodes.get(s.b)!, model.ref);
    if (!a || !b) continue;
    const va = anchorToView(project, model, a);
    const vb = anchorToView(project, model, b);
    const q = projectOntoSegment({ ...a, ...va }, { ...b, ...vb }, p.u, p.v);
    const d = near(q);
    if (d <= r && q.t > 0 && q.t < 1 && (!seg || d < seg.d))
      seg = { id: s.id, at: { u: q.u, v: q.v }, d };
  }
  if (seg) return { kind: "segment", at: seg.at, segmentId: seg.id };

  const contour = edgeContour(project, model);
  const edge = contour.length > 1 ? projectOnPolyline(contour, p) : null;
  if (edge && edge.d <= r) {
    let at = edge.at;
    // Auf der Kante zusätzlich den Winkelfang anwenden, wenn er auf der Kante bleibt
    if (opts.prev && !opts.noAngle) {
      const snapped = angleSnap(at, opts.prev);
      const back = projectOnPolyline(contour, snapped);
      if (back && back.d <= 1) at = back.at;
    }
    const anchor = viewToAnchor(project, model, at);
    if (edgeAnchors(project, anchor).length > 0)
      return { kind: "edge", at: { u: anchor.u, v: anchor.v + viewDv(project, model, anchor.u) } };
  }

  const free = opts.prev && !opts.noAngle ? angleSnap(p, opts.prev) : p;
  return { kind: "free", at: { u: Math.round(free.u), v: Math.round(free.v) } };
}
