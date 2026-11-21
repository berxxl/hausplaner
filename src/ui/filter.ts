/** Gewerkfilter (design.md M2 „Gewerkfilter“): Sichtbarkeit von Geräten und Möbeln. Frei von React. */
import type { Device, Project, Trade } from "../model/types";
import type { Selection, ViewState } from "../store/view";

export type FilterState = Pick<ViewState, "hiddenTrades" | "furnitureHidden">;

/** Gewerk eines Geräts; Geräte mit unbekanntem Typ zählen zu „Sonstiges“. */
export function deviceTrade(project: Project, device: Device): Trade {
  return project.catalog.deviceTypes.find((t) => t.id === device.typeId)?.trade ?? "other";
}

export function isDeviceVisible(project: Project, filter: FilterState, device: Device): boolean {
  return (
    filter.hiddenTrades.length === 0 || !filter.hiddenTrades.includes(deviceTrade(project, device))
  );
}

/** Auswahl ohne ausgeblendete Elemente; null, wenn nichts übrig bleibt. */
export function visibleSelection(
  project: Project,
  filter: FilterState,
  selection: Selection | null,
): Selection | null {
  if (!selection) return null;
  if (selection.kind === "furniture") return filter.furnitureHidden ? null : selection;
  if (selection.kind !== "device") return selection;
  const ids = (selection.ids ?? [selection.id]).filter((id) => {
    const d = project.devices.find((x) => x.id === id);
    return !d || isDeviceVisible(project, filter, d);
  });
  if (ids.length === 0) return null;
  return { kind: "device", id: ids[0]!, ...(ids.length > 1 ? { ids } : {}) };
}
