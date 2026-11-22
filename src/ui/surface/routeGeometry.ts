/** Trassen einer Flächenansicht in Ansichtskoordinaten (design.md M3 „Darstellung“). Frei von React. */
import { anchorOn } from "../../geometry/routes";
import type { Project } from "../../model/types";
import type { SurfaceModel, UV } from "./model";
import { anchorToView } from "./routeSnap";

export const HIGHLIGHT_COLOR = "#ff8a00";

export interface RouteGeometry {
  segments: { id: string; a: UV; b: UV; status: string; conduit: boolean }[];
  nodes: { id: string; at: UV; transition: boolean; device: boolean }[];
  penetrations: { id: string; at: UV; diameterMm: number }[];
}

/** Segmente, Knoten und Durchbrüche, die auf der Fläche der Ansicht liegen (Raumansicht: im u-Bereich). */
export function routeGeometry(project: Project, model: SurfaceModel): RouteGeometry {
  const t = 1;
  const inRange = (u: number) =>
    !model.uRange || (u >= model.uRange[0] - t && u <= model.uRange[1] + t);
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  const shownNodes = new Map<string, RouteGeometry["nodes"][number]>();
  const at = (id: string) => {
    const n = nodes.get(id);
    const a = n && anchorOn(n, model.ref);
    return a && inRange(a.u) ? anchorToView(project, model, a) : null;
  };
  for (const n of project.routeNodes) {
    const p = at(n.id);
    if (p)
      shownNodes.set(n.id, {
        id: n.id,
        at: p,
        transition: n.anchors.length > 1,
        device: !!n.deviceId,
      });
  }
  const segments: RouteGeometry["segments"] = [];
  const penetrations: RouteGeometry["penetrations"] = [];
  for (const s of project.routeSegments) {
    if (s.kind === "surface") {
      if (s.surface !== model.ref) continue;
      const a = at(s.a);
      const b = at(s.b);
      if (a && b) segments.push({ id: s.id, a, b, status: s.status, conduit: !!s.conduit });
    } else if (s.penetration) {
      const p = at(s.a) ?? at(s.b);
      if (p) penetrations.push({ id: s.id, at: p, diameterMm: s.penetration.diameterMm });
    }
  }
  return { segments, nodes: [...shownNodes.values()], penetrations };
}
