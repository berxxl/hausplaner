/**
 * Warnungen zu KNX (design.md M4 „KNX“): Verbraucher ohne Kanal, Kanal passt nicht. Frei von React.
 */
import { actuatorProvides, consumerBoardId, consumerFunction, knxConsumers } from "../geometry/knx";
import type { Project } from "../model/types";
import type { ProjectWarning } from "./index";

export function knxWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  const devices = new Map(project.devices.map((d) => [d.id, d]));
  for (const c of knxConsumers(project)) {
    // nur Verbraucher mit Verteiler (design.md M4, Entscheidung 7)
    if (consumerBoardId(project, c) === null) continue;
    const a = project.knxAssignments.find((x) => x.consumerDeviceId === c.id);
    const actuator = a ? devices.get(a.actuatorDeviceId) : undefined;
    if (!a || !actuator) {
      warnings.push({
        key: `knx-without-channel:${c.id}`,
        text: `Kein KNX-Kanal: ${c.label}`,
        target: { kind: "device", id: c.id },
      });
      continue;
    }
    const provides = actuatorProvides(project, actuator);
    const board = actuator.placement.kind === "board" ? actuator.placement.boardId : undefined;
    if (
      !provides ||
      provides.function !== consumerFunction(project, c) ||
      a.channel > provides.channels ||
      board !== consumerBoardId(project, c)
    )
      warnings.push({
        key: `knx-channel-mismatch:${c.id}`,
        text: `KNX-Kanal passt nicht: ${c.label}`,
        target: { kind: "device", id: c.id },
      });
  }
  return warnings;
}
