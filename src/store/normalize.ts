/**
 * Abhängige Änderungen, die zu jedem Befehl gehören und deshalb im selben Patch landen
 * (design.md M2 „Store und Befehle“): Höhenbezug von Wandgeräten bei geänderter Raumzuordnung.
 * Frei von React.
 */
import { current, type Draft } from "immer";
import { deviceHeightAdjustments } from "../geometry/devices";
import type { Project } from "../model/types";

export function normalizeAfterCommand(base: Project, draft: Draft<Project>): void {
  if (draft.devices.length === 0) return;
  const after = current(draft) as Project;
  // Raumzuordnung kann sich nur ändern, wenn Wände, Räume oder Geschosse geändert wurden
  if (after.walls === base.walls && after.rooms === base.rooms && after.storeys === base.storeys)
    return;
  for (const { id, delta } of deviceHeightAdjustments(base, after)) {
    const d = draft.devices.find((x) => x.id === id);
    if (d && d.placement.kind === "surface") d.placement.v += delta;
  }
}
