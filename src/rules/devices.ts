/**
 * Warnungen zu Geräten und Möbeln (design.md M2 „Warnungen“): außerhalb der Fläche, ohne Fläche,
 * ohne Typ. Verweise ins Leere sind nicht übergehbar und haben die Aktion „Löschen“. Frei von React.
 */
import { wallDeviceBuildup } from "../geometry/devices";
import { pointInPolygon } from "../geometry/polygon";
import { deriveSurfaces } from "../geometry/surfaces";
import { surfaceKind } from "../model/devices";
import type { Project } from "../model/types";
import type { ProjectWarning } from "./index";

export function deviceWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  const surfaces = new Map(deriveSurfaces(project).map((s) => [s.ref, s]));
  const typeIds = new Set(project.catalog.deviceTypes.map((t) => t.id));
  for (const device of project.devices) {
    const remove = { kind: "device" as const, id: device.id };
    if (!typeIds.has(device.typeId))
      warnings.push({
        key: `device-without-type:${device.id}`,
        text: `Gerät mit unbekanntem Typ (${device.typeId})`,
        target: { kind: "none" },
        deletable: remove,
      });
    const p = device.placement;
    if (p.kind !== "surface") continue;
    const surface = surfaces.get(p.surface);
    if (!surface) {
      warnings.push({
        key: `device-without-surface:${device.id}`,
        text: `Gerät ohne Fläche (${p.surface})`,
        target: { kind: "none" },
        deletable: remove,
      });
      continue;
    }
    // Wandseite: ganze Seite in Rohbaumaßen, verglichen mit der Rohbauhöhe v + Fußbodenaufbau
    const v = surfaceKind(p.surface) === "wall" ? p.v + wallDeviceBuildup(project, device) : p.v;
    const xs = surface.contour.map((c) => c.u);
    const ys = surface.contour.map((c) => c.v);
    const inside =
      surface.kind === "wall-side"
        ? p.u >= Math.min(...xs) &&
          p.u <= Math.max(...xs) &&
          v >= Math.min(...ys) &&
          v <= Math.max(...ys)
        : pointInPolygon(
            { x: p.u, y: v },
            surface.contour.map((c) => ({ x: c.u, y: c.v })),
          );
    if (!inside)
      warnings.push({
        key: `device-off-surface:${device.id}`,
        text: `Gerät außerhalb der Fläche: ${device.label}`,
        target: { kind: "device", id: device.id },
      });
  }
  return warnings;
}

export function furnitureWarnings(project: Project): ProjectWarning[] {
  const typeIds = new Set(project.catalog.furnitureTypes.map((t) => t.id));
  return project.furniture
    .filter((f) => !typeIds.has(f.typeId))
    .map((f) => ({
      key: `furniture-without-type:${f.id}`,
      text: `Möbel mit unbekanntem Typ (${f.typeId})`,
      target: { kind: "none" as const },
      deletable: { kind: "furniture" as const, id: f.id },
    }));
}
