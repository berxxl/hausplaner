/**
 * Warnungen zu Kältemittel und Kondensat (design.md M6 „Warnungen“): Länge gegen die Grenzen des
 * Außengeräts, Enden der Kältemittelleitung, Innengerät ohne Kondensatleitung, Kondensatgefälle.
 * Alle übergehbar. Frei von React.
 */
import {
  acUnitOf,
  condensateLinks,
  condensateSlopes,
  formatMeters,
  formatSlope,
  isCondensateCable,
  isRefrigerantCable,
  refrigerantEnds,
  refrigerantLinks,
} from "../geometry/refrigerant";
import { endpointExists } from "../geometry/cables";
import type { Project } from "../model/types";
import type { ProjectWarning } from "./index";

const fmtLimit = (m: number) => `${String(m).replace(".", ",")} m`;

export function refrigerantWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  const cables = new Map(project.cables.map((c) => [c.id, c]));
  for (const link of refrigerantLinks(project)) {
    if (link.lengthMm === null || !link.limits) continue;
    const label = cables.get(link.cableId)!.label;
    const target = { kind: "cable" as const, id: link.cableId };
    // Vergleich auf der angezeigten Länge (eine Nachkommastelle)
    const shown = Math.round(link.lengthMm / 100) / 10;
    if (shown > link.limits.maxLengthM)
      warnings.push({
        key: `refrigerant-too-long:${link.cableId}`,
        text: `Kältemittelleitung zu lang: ${label} ${formatMeters(link.lengthMm)} (höchstens ${fmtLimit(link.limits.maxLengthM)})`,
        target,
      });
    else if (shown < link.limits.minLengthM)
      warnings.push({
        key: `refrigerant-too-short:${link.cableId}`,
        text: `Kältemittelleitung zu kurz: ${label} ${formatMeters(link.lengthMm)} (mindestens ${fmtLimit(link.limits.minLengthM)})`,
        target,
      });
  }
  for (const c of project.cables) {
    if (!endpointExists(project, c.from) || !endpointExists(project, c.to)) continue;
    if (isRefrigerantCable(project, c) && !refrigerantEnds(project, c))
      warnings.push({
        key: `refrigerant-ends:${c.id}`,
        text: `Kältemittelleitung verbindet nicht Innen- und Außengerät: ${c.label}`,
        target: { kind: "cable", id: c.id },
      });
  }
  for (const d of project.devices) {
    if (acUnitOf(project, d) !== "indoor") continue;
    if (condensateLinks(project, d.id).length === 0)
      warnings.push({
        key: `ac-without-condensate:${d.id}`,
        text: `Klima-Innengerät ohne Kondensatleitung: ${d.label}`,
        target: { kind: "device", id: d.id },
      });
  }
  // Gefälle: eine Warnung je Segment (erste Leitung nach ID)
  const seen = new Set<string>();
  const min = project.settings.condensateMinSlopePercent;
  for (const c of [...project.cables].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!isCondensateCable(project, c)) continue;
    for (const s of condensateSlopes(project, c) ?? []) {
      if (s.ok || seen.has(s.segmentId)) continue;
      seen.add(s.segmentId);
      const value = s.dropMm < 0 ? "steigt an" : formatSlope(s.percent ?? 0);
      warnings.push({
        key: `condensate-slope:${s.segmentId}`,
        text: `Kondensat ohne Gefälle: ${c.label} (${value}, mindestens ${formatSlope(min)})`,
        target: { kind: "route-segment", id: s.segmentId },
      });
    }
  }
  return warnings;
}
