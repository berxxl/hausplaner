/**
 * Warnungen zu Verteilern (design.md M4 „Warnungen“): Reserve, ohne Zuleitung, Reiheneinbaugeräte
 * außerhalb der Reihe oder überlappend, Verweise ins Leere. Frei von React.
 */
import { boardLayoutIssues } from "../geometry/boards";
import { boardReserve } from "../geometry/reserve";
import type { Project } from "../model/types";
import type { ProjectWarning } from "./index";

export function boardWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  const walls = new Set(project.walls.map((w) => w.id));
  const hasMeter = project.boards.some((b) => b.kind === "meter-cabinet");
  const label = (id: string) => project.devices.find((d) => d.id === id)?.label ?? id;
  for (const b of project.boards) {
    if (!walls.has(b.placement.surface.split(":")[1]!)) {
      warnings.push({
        key: `board-without-surface:${b.id}`,
        text: `Verteiler ohne Fläche (${b.placement.surface})`,
        target: { kind: "none" },
        deletable: { kind: "board", id: b.id },
      });
      continue;
    }
    const r = boardReserve(project, b);
    if (r.low)
      warnings.push({
        key: `board-reserve-low:${b.id}`,
        text: `Reserve unter ${project.settings.teReservePercent} %: ${r.free} von ${r.total} TE frei`,
        target: { kind: "board", id: b.id, open: true },
      });
    if (hasMeter && b.kind !== "meter-cabinet" && b.parentBoardId === undefined)
      warnings.push({
        key: `board-without-parent:${b.id}`,
        text: `Verteiler ohne Zuleitung: ${b.label}`,
        target: { kind: "board", id: b.id },
      });
    const issues = boardLayoutIssues(project, b);
    for (const id of new Set(issues.outside))
      warnings.push({
        key: `board-device-outside:${id}`,
        text: `Reiheneinbaugerät außerhalb der Reihe: ${label(id)}`,
        target: { kind: "board-device", id },
      });
    for (const id of new Set(issues.overlap))
      warnings.push({
        key: `board-device-overlap:${id}`,
        text: `Reiheneinbaugeräte überlappen: ${label(id)}`,
        target: { kind: "board-device", id },
      });
  }
  for (const d of project.devices) {
    if (d.placement.kind !== "board") continue;
    const { boardId, fieldId } = d.placement;
    const b = project.boards.find((x) => x.id === boardId);
    if (!b || !b.fields.some((f) => f.id === fieldId))
      warnings.push({
        key: `board-device-without-board:${d.id}`,
        text: "Reiheneinbaugerät ohne Verteiler oder Feld",
        target: { kind: "none" },
        deletable: { kind: "device", id: d.id },
      });
  }
  const boards = new Set(project.boards.map((b) => b.id));
  for (const n of project.routeNodes)
    if (n.boardId !== undefined && !boards.has(n.boardId))
      warnings.push({
        key: `route-node-without-board:${n.id}`,
        text: "Trassenknoten an unbekanntem Verteiler",
        target: { kind: "none" },
        detachBoardNode: n.id,
      });
  return warnings;
}
