/** Zwischengespeicherte abgeleitete Ansichten je Projektstand (nie gespeichert). */
import {
  deriveRoomViews,
  freeSurfaces,
  type FreeSurface,
  type RoomView,
} from "../geometry/surfaces";
import type { Project } from "../model/types";

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
