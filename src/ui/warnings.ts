import { openingURange, wallSides } from "../geometry/surfaces";
import type { ProjectWarning } from "../rules";
import { roomViewsOf } from "./derived";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";

/** Wählt das Ziel einer Warnung aus und öffnet die passende Ansicht (design.md Tabelle „Warnungen“). */
export function activateWarning(
  warning: ProjectWarning,
  store: ProjectStore,
  view: ViewStore,
): void {
  const { target } = warning;
  const project = store.getState().project;
  if (target.kind === "room") {
    const room = project.rooms.find((r) => r.id === target.id);
    if (room) view.setActiveStorey(room.storeyId);
    view.select({ kind: "room", id: target.id });
    view.setEditor("plan");
  } else if (target.kind === "opening") {
    const opening = project.openings.find((o) => o.id === target.id);
    view.select({ kind: "opening", id: target.id });
    if (!opening) return;
    view.setActiveStorey(opening.storeyId);
    // Wandansicht des Raums an Seite L, in dessen Abschnitt die Mitte der Öffnung liegt; sonst die ganze Wandseite L
    const ref = `wall:${opening.wallId}:L`;
    const side = wallSides(project, opening.storeyId).find((s) => s.ref === ref);
    if (!side) return;
    const [u1, u2] = openingURange(side, opening);
    const mid = (u1 + u2) / 2;
    for (const views of roomViewsOf(project).values()) {
      const v = views.find((x) => x.ref === ref && mid >= x.section.uFrom && mid <= x.section.uTo);
      if (v) return view.openSurface({ kind: "room-wall", key: v.key }, opening.storeyId);
    }
    view.openSurface({ kind: "wall-side", ref }, opening.storeyId);
  }
}
