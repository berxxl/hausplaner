import type { ProjectWarning } from "../rules";
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
    if (opening) view.setActiveStorey(opening.storeyId);
    view.select({ kind: "opening", id: target.id });
  }
}
