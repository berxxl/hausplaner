/** Zwischengespeicherte abgeleitete Ansichten je Projektstand (nie gespeichert). */
import {
  deriveRoomViews,
  freeSurfaces,
  type FreeSurface,
  type RoomView,
} from "../geometry/surfaces";
import type { Cable, Project } from "../model/types";
import { circuitCables, circuitDevices } from "../geometry/circuits";
import type { PathEdit, Selection } from "../store/view";
import { computeWarnings, type ProjectWarning } from "../rules";

const roomViewCache = new WeakMap<Project, Map<string, RoomView[]>>();
const freeCache = new WeakMap<Project, Map<string, FreeSurface[]>>();

export function roomViewsOf(project: Project): Map<string, RoomView[]> {
  let v = roomViewCache.get(project);
  if (!v) roomViewCache.set(project, (v = deriveRoomViews(project)));
  return v;
}

export function freeSurfacesOf(project: Project, storeyId: string): FreeSurface[] {
  let m = freeCache.get(project);
  if (!m) freeCache.set(project, (m = new Map()));
  let list = m.get(storeyId);
  if (!list) m.set(storeyId, (list = freeSurfaces(project, storeyId)));
  return list;
}

export function findRoomView(project: Project, key: string): RoomView | undefined {
  for (const views of roomViewsOf(project).values()) {
    const v = views.find((x) => x.key === key);
    if (v) return v;
  }
  return undefined;
}

const warningCache = new WeakMap<Project, ProjectWarning[]>();

/** Alle berechneten Warnungen (zwischengespeichert je Projektstand). */
export function warningsOf(project: Project): ProjectWarning[] {
  let w = warningCache.get(project);
  if (!w) warningCache.set(project, (w = computeWarnings(project)));
  return w;
}

/** IDs der Geräte und Möbel mit offener (nicht übergangener) Warnung: roter Rand in allen Ansichten. */
export function warnedIds(project: Project): Set<string> {
  const suppressed = new Set(project.suppressedWarnings);
  const ids = new Set<string>();
  for (const w of warningsOf(project))
    if (
      (w.target.kind === "device" ||
        w.target.kind === "route-node" ||
        w.target.kind === "route-segment" ||
        w.target.kind === "cable") &&
      !suppressed.has(w.key)
    )
      ids.add(w.target.id);
  return ids;
}

/**
 * Hervorgehobene Segmente und Geräte (design.md M3 „Leitungen“, M4 „Stromkreise“): Weg bearbeiten,
 * ausgewählte Leitung bzw. alle Geräte und Leitungen des ausgewählten Stromkreises.
 */
export function highlightOf(
  project: Project,
  selection: Selection | null,
  pathEdit: PathEdit | null,
  cableVisible: (c: Cable) => boolean = () => true,
): { segments: Set<string>; devices: Set<string> } {
  if (pathEdit) return { segments: new Set(pathEdit.segmentIds), devices: new Set() };
  if (selection?.kind === "cable") {
    const c = project.cables.find((x) => x.id === selection.id);
    return { segments: new Set(c && cableVisible(c) ? c.path : []), devices: new Set() };
  }
  if (selection?.kind === "circuit") {
    const cables = circuitCables(project, selection.id).filter(cableVisible);
    return {
      segments: new Set(cables.flatMap((c) => c.path)),
      devices: new Set(circuitDevices(project, selection.id).map((d) => d.id)),
    };
  }
  return { segments: new Set(), devices: new Set() };
}
