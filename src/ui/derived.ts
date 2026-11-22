/** Zwischengespeicherte abgeleitete Ansichten je Projektstand (nie gespeichert). */
import {
  deriveRoomViews,
  freeSurfaces,
  type FreeSurface,
  type RoomView,
} from "../geometry/surfaces";
import type { Project } from "../model/types";
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
