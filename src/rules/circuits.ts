/**
 * Warnungen zu Stromkreisen (design.md M4 „Stromkreise“, „Warnungen“): Gerät ohne Stromkreis,
 * Leitung zu anderem Verteiler, Stromkreis an unbekanntem Verteiler. Frei von React.
 */
import { circuitShortName, feedingBoards, isCircuitDevice } from "../geometry/circuits";
import type { Project } from "../model/types";
import type { ProjectWarning } from "./index";

export function circuitWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  const boards = new Map(project.boards.map((b) => [b.id, b]));
  const circuits = new Map(project.circuits.map((c) => [c.id, c]));
  for (const c of project.circuits)
    if (!boards.has(c.boardId))
      warnings.push({
        key: `circuit-without-board:${c.id}`,
        text: `Stromkreis an unbekanntem Verteiler: ${c.label}`,
        target: { kind: "none" },
        deletable: { kind: "circuit", id: c.id },
      });
  for (const d of project.devices) {
    if (!isCircuitDevice(project, d)) continue;
    const circuit = d.circuitId === undefined ? undefined : circuits.get(d.circuitId);
    // erst, wenn die Stromkreisplanung begonnen hat (design.md M4, Entscheidung 7)
    if (!circuit && project.circuits.length === 0) continue;
    if (!circuit) {
      warnings.push({
        key: `device-without-circuit:${d.id}`,
        text: `Kein Stromkreis: ${d.label}`,
        target: { kind: "device", id: d.id },
      });
      continue;
    }
    const board = boards.get(circuit.boardId);
    if (!board) continue;
    const other = feedingBoards(project, d.id).find((b) => b !== circuit.boardId);
    if (other)
      warnings.push({
        key: `circuit-board-mismatch:${d.id}`,
        text: `${circuitShortName(circuit.label)} liegt in ${board.label}, Leitung führt zu ${boards.get(other)?.label ?? other}`,
        target: { kind: "device", id: d.id },
      });
  }
  return warnings;
}
