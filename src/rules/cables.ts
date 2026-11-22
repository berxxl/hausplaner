/**
 * Warnungen zu Leitungen (design.md M3 „Warnungen“): ohne Weg bzw. Weg unterbrochen, Verweise ins
 * Leere (Typ, Gerät). Frei von React.
 */
import { isPathConnected } from "../geometry/cables";
import type { Project } from "../model/types";
import type { ProjectWarning } from "./index";

export function cableWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  const types = new Set(project.catalog.lineTypes.map((t) => t.id));
  const devices = new Set(project.devices.map((d) => d.id));
  for (const c of project.cables) {
    const remove = { kind: "cable" as const, id: c.id };
    if (!types.has(c.lineTypeId))
      warnings.push({
        key: `cable-without-type:${c.id}`,
        text: `Leitung mit unbekanntem Typ (${c.lineTypeId})`,
        target: { kind: "none" },
        deletable: remove,
      });
    if (!devices.has(c.from.deviceId) || !devices.has(c.to.deviceId)) {
      warnings.push({
        key: `cable-without-device:${c.id}`,
        text: "Leitung an unbekanntem Gerät",
        target: { kind: "none" },
        deletable: remove,
      });
      continue;
    }
    if (c.path.length === 0)
      warnings.push({
        key: `cable-without-path:${c.id}`,
        text: `Leitung ohne Weg: ${c.label}`,
        target: { kind: "cable", id: c.id },
      });
    else if (!isPathConnected(project, c))
      warnings.push({
        key: `cable-without-path:${c.id}`,
        text: `Weg unterbrochen: ${c.label}`,
        target: { kind: "cable", id: c.id },
      });
  }
  return warnings;
}
