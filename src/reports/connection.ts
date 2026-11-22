/**
 * „Anschluss im Verteiler“ eines Geräts (design.md M5 „Die Listen im Einzelnen“): Stromkreis,
 * KNX-Kanal, direkte Leitungen zu Verteilern. Frei von React.
 */
import { feedingBoards, lineTypeTrade } from "../geometry/circuits";
import { channelLabel } from "../geometry/knx";
import type { Device, Project } from "../model/types";

export const NOT_CONNECTED = "nicht angeschlossen";

/** Einträge in der festgelegten Reihenfolge; leer = nicht angeschlossen. */
export function connectionEntries(project: Project, device: Device): string[] {
  const boardLabel = (id: string | undefined) =>
    project.boards.find((b) => b.id === id)?.label ?? "?";
  const entries: string[] = [];
  // 1. Stromkreis
  const circuit = project.circuits.find((c) => c.id === device.circuitId);
  if (circuit) {
    const protection = project.devices.find((d) => d.id === circuit.protectionDeviceId);
    entries.push(
      `${boardLabel(circuit.boardId)} · ${circuit.label}${protection ? ` (${protection.label})` : ""}`,
    );
  } else {
    for (const b of feedingBoards(project, device.id))
      entries.push(`${boardLabel(b)} · ohne Stromkreis`);
  }
  // 2. KNX-Kanäle
  const assignments = project.knxAssignments
    .filter((a) => a.consumerDeviceId === device.id)
    .sort((a, b) =>
      a.actuatorDeviceId < b.actuatorDeviceId
        ? -1
        : a.actuatorDeviceId > b.actuatorDeviceId
          ? 1
          : a.channel - b.channel,
    );
  for (const a of assignments) {
    const actuator = project.devices.find((d) => d.id === a.actuatorDeviceId);
    if (!actuator) continue;
    const boardId = actuator.placement.kind === "board" ? actuator.placement.boardId : undefined;
    entries.push(`${boardLabel(boardId)} · ${channelLabel(actuator.label, a.channel)}`);
  }
  // 3. Leitungen zu Verteilern, die nicht Strom sind
  const cables = project.cables
    .filter((c) => lineTypeTrade(project, c) !== "power")
    .filter(
      (c) =>
        (c.from.deviceId === device.id && c.to.boardId !== undefined) ||
        (c.to.deviceId === device.id && c.from.boardId !== undefined),
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const c of cables) {
    const boardId = c.from.boardId ?? c.to.boardId;
    const type = project.catalog.lineTypes.find((t) => t.id === c.lineTypeId);
    const entry = `${boardLabel(boardId)} · ${type?.name ?? c.lineTypeId}`;
    if (!entries.includes(entry)) entries.push(entry);
  }
  return entries;
}

export function connectionText(project: Project, device: Device): string {
  const e = connectionEntries(project, device);
  return e.length > 0 ? e.join("; ") : NOT_CONNECTED;
}
