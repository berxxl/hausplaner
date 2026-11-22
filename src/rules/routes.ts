/**
 * Warnungen zu Trassen (design.md M3 „Zonenprüfung“, „Warnungen“): außerhalb der
 * Installationszone, Leerrohr überfüllt, Übergang nicht mehr auf der Kante, Verweise ins Leere.
 * Frei von React.
 */
import { CONDUIT_FILL_LIMIT, occupancy } from "../geometry/cables";
import { anchorOn, EDGE_TOLERANCE_MM, rederivedAnchors, roomViewAt } from "../geometry/routes";
import { deriveSurfaces } from "../geometry/surfaces";
import { topAt, viewZones } from "../geometry/zones";
import { surfaceKind } from "../model/devices";
import type { Project, RouteNode, RouteSegment } from "../model/types";
import type { ProjectWarning } from "./index";

export function routeWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  const surfaces = new Set(deriveSurfaces(project).map((s) => s.ref));
  const devices = new Set(project.devices.map((d) => d.id));
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));

  for (const n of project.routeNodes) {
    const missing = n.anchors.find((a) => !surfaces.has(a.surface));
    if (missing) {
      warnings.push({
        key: `route-node-without-surface:${n.id}`,
        text: `Trassenknoten ohne Fläche (${missing.surface})`,
        target: { kind: "none" },
        deletable: { kind: "route-node", id: n.id },
      });
      continue;
    }
    if (n.deviceId && !devices.has(n.deviceId))
      warnings.push({
        key: `route-node-without-device:${n.id}`,
        text: "Trassenknoten an unbekanntem Gerät",
        target: { kind: "none" },
        detachNode: n.id,
      });
    if (n.anchors.length > 1 && rederivedAnchors(project, n) === null)
      warnings.push({
        key: `route-node-off-edge:${n.id}`,
        text: "Übergang nicht mehr auf der Kante",
        target: { kind: "route-node", id: n.id },
      });
  }

  for (const s of project.routeSegments) {
    if (!nodes.has(s.a) || !nodes.has(s.b)) {
      warnings.push({
        key: `route-segment-without-node:${s.id}`,
        text: "Segment mit unbekanntem Knoten",
        target: { kind: "none" },
        deletable: { kind: "route-segment", id: s.id },
      });
      continue;
    }
    const { fill } = occupancy(project, s.id);
    if (fill !== null && fill > CONDUIT_FILL_LIMIT)
      warnings.push({
        key: `conduit-overfull:${s.id}`,
        text: `Leerrohr überfüllt (${Math.round(fill * 100)} %)`,
        target: { kind: "route-segment", id: s.id },
      });
    if (outsideZone(project, s, nodes))
      warnings.push({
        key: `route-outside-zone:${s.id}`,
        text: "Trasse außerhalb Installationszone",
        target: { kind: "route-segment", id: s.id },
      });
  }
  return warnings;
}

/**
 * Wandsegment in einer Raumansicht, das keine der Bedingungen aus design.md M3 „Zonenprüfung“
 * erfüllt: waagerecht in einer waagerechten Zone, senkrecht in einer senkrechten Zone oder Teil
 * einer senkrechten Kette von einer waagerechten Zone zu einem Gerätknoten oder einem Übergang zu
 * Decke, Schräge oder Boden.
 */
function outsideZone(
  project: Project,
  s: RouteSegment,
  nodes: ReadonlyMap<string, RouteNode>,
): boolean {
  if (s.kind !== "surface" || !s.surface || surfaceKind(s.surface) !== "wall") return false;
  const pa = anchorOn(nodes.get(s.a)!, s.surface);
  const pb = anchorOn(nodes.get(s.b)!, s.surface);
  if (!pa || !pb) return false;
  const view = roomViewAt(project, s.surface, (pa.u + pb.u) / 2);
  if (!view) return false;
  const t = EDGE_TOLERANCE_MM;
  const settings = project.settings.installZones;
  const zones = viewZones(view, settings);
  const [ta, tb] = settings.horizontalTop;
  const [ba, bb] = settings.horizontalBottom;
  const inTop = (u: number, v: number) =>
    v >= topAt(view, u) - tb - t && v <= topAt(view, u) - ta + t;
  const inBottom = (v: number) => v >= ba - t && v <= bb + t;
  const inHorizontal = (u: number, v: number) => inTop(u, v) || inBottom(v);
  const inVertical = (u: number) => zones.vertical.some((z) => u >= z.uFrom - t && u <= z.uTo + t);
  const horizontal = Math.abs(pa.v - pb.v) <= t;
  const vertical = Math.abs(pa.u - pb.u) <= t;
  if (
    horizontal &&
    ((inTop(pa.u, pa.v) && inTop(pb.u, pb.v)) || (inBottom(pa.v) && inBottom(pb.v)))
  )
    return false;
  if (!vertical) return true;
  if (inVertical(pa.u)) return false;
  // Senkrechte Kette auf derselben Fläche und derselben u-Lage
  const u = pa.u;
  const chain = new Set([s.a, s.b]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of project.routeSegments) {
      if (x.kind !== "surface" || x.surface !== s.surface) continue;
      if (chain.has(x.a) === chain.has(x.b)) continue;
      const xa = nodes.get(x.a) && anchorOn(nodes.get(x.a)!, s.surface);
      const xb = nodes.get(x.b) && anchorOn(nodes.get(x.b)!, s.surface);
      if (!xa || !xb || Math.abs(xa.u - u) > t || Math.abs(xb.u - u) > t) continue;
      chain.add(x.a);
      chain.add(x.b);
      grew = true;
    }
  }
  const members = [...chain].map((id) => nodes.get(id)!);
  // Ende an einem Gerät oder an einem Übergang zu Decke, Schräge oder Boden
  const atDevice = members.some(
    (n) => n.deviceId || n.anchors.some((a) => surfaceKind(a.surface) !== "wall"),
  );
  const fromZone = members.some((n) => {
    const a = anchorOn(n, s.surface!);
    return !!a && inHorizontal(a.u, a.v);
  });
  return !(atDevice && fromZone);
}
