/**
 * Gewerkfilter (design.md M2 „Gewerkfilter“, M3 „Darstellung“): Sichtbarkeit von Geräten, Möbeln,
 * Trassen und Leitungen. Frei von React.
 */
import type { Cable, Device, Project, Trade } from "../model/types";
import type { Selection, ViewState } from "../store/view";

export type FilterState = Pick<ViewState, "hiddenTrades" | "furnitureHidden"> &
  Partial<Pick<ViewState, "routesHidden">>;

/** Gewerk eines Geräts; Geräte mit unbekanntem Typ zählen zu „Sonstiges“. */
export function deviceTrade(project: Project, device: Device): Trade {
  return project.catalog.deviceTypes.find((t) => t.id === device.typeId)?.trade ?? "other";
}

export function isDeviceVisible(project: Project, filter: FilterState, device: Device): boolean {
  return (
    filter.hiddenTrades.length === 0 || !filter.hiddenTrades.includes(deviceTrade(project, device))
  );
}

/** Leitungen folgen dem Gewerk ihres Leitungstyps (unbekannter Typ: „Sonstiges“). */
export function isCableVisible(project: Project, filter: FilterState, cable: Cable): boolean {
  const trade = project.catalog.lineTypes.find((t) => t.id === cable.lineTypeId)?.trade ?? "other";
  return !filter.hiddenTrades.includes(trade);
}

/** Auswahl ohne ausgeblendete Elemente; null, wenn nichts übrig bleibt. */
export function visibleSelection(
  project: Project,
  filter: FilterState,
  selection: Selection | null,
): Selection | null {
  if (!selection) return null;
  if (selection.kind === "furniture") return filter.furnitureHidden ? null : selection;
  if (selection.kind === "route-node" || selection.kind === "route-segment")
    return filter.routesHidden ? null : selection;
  if (selection.kind === "cable") {
    const c = project.cables.find((x) => x.id === selection.id);
    return c && !isCableVisible(project, filter, c) ? null : selection;
  }
  if (selection.kind !== "device") return selection;
  const ids = (selection.ids ?? [selection.id]).filter((id) => {
    const d = project.devices.find((x) => x.id === id);
    return !d || isDeviceVisible(project, filter, d);
  });
  if (ids.length === 0) return null;
  return { kind: "device", id: ids[0]!, ...(ids.length > 1 ? { ids } : {}) };
}
