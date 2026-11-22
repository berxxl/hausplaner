/**
 * Befehle für KNX (design.md M4 „KNX“): Aktorvorschlag übernehmen, Kanäle zuordnen (von Hand und
 * automatisch), Linien. Frei von React.
 */
import {
  actuatorProvides,
  autoAssignments,
  consumerFunction,
  isBusParticipant,
  planSuggestion,
  reachableParticipants,
} from "../geometry/knx";
import type { Device, KnxLine, Project } from "../model/types";
import type { Checked } from "./catalog";
import type { Command } from "./history";

/** „Aktorvorschlag übernehmen“ für alle Funktionen; zu wenig Platz lehnt ganz ab. */
export function adoptSuggestion(project: Project, boardId: string, ids: string[]): Checked {
  const board = project.boards.find((b) => b.id === boardId);
  if (!board) return { ok: false, error: "Verteiler nicht gefunden" };
  const plan = planSuggestion(project, board);
  if (!plan.ok) return { ok: false, error: `Nicht genug Platz: es fehlen ${plan.missingTe} TE` };
  if (plan.actuators.length === 0) return { ok: false, error: "Kein Aktor nötig" };
  const devices: Device[] = plan.actuators.map((a, i) => ({
    id: ids[i]!,
    label: a.label,
    typeId: a.typeId,
    status: "planned",
    storeyId: board.storeyId,
    placement: { kind: "board", boardId, ...a.placement },
  }));
  return {
    ok: true,
    command: {
      label: "Aktorvorschlag übernehmen",
      run(draft) {
        draft.devices.push(...structuredClone(devices));
      },
    },
  };
}

/**
 * „Kanal zuordnen“: ein Verbraucher hat höchstens einen Kanal (ersetzt den alten), ein Kanal
 * höchstens einen Verbraucher; `null` löst die Zuordnung.
 */
export function assignChannel(
  project: Project,
  consumerId: string,
  channel: { actuatorDeviceId: string; channel: number } | null,
): Checked {
  const consumer = project.devices.find((d) => d.id === consumerId);
  if (!consumer || !consumerFunction(project, consumer))
    return { ok: false, error: "Kein KNX-Verbraucher" };
  if (channel) {
    const actuator = project.devices.find((d) => d.id === channel.actuatorDeviceId);
    const provides = actuator ? actuatorProvides(project, actuator) : undefined;
    if (!provides || channel.channel < 1 || channel.channel > provides.channels)
      return { ok: false, error: "Kanal nicht vorhanden" };
    const taken = project.knxAssignments.find(
      (a) =>
        a.actuatorDeviceId === channel.actuatorDeviceId &&
        a.channel === channel.channel &&
        a.consumerDeviceId !== consumerId,
    );
    if (taken) return { ok: false, error: "Kanal ist schon belegt" };
  }
  return {
    ok: true,
    command: {
      label: "Kanal zuordnen",
      run(draft) {
        draft.knxAssignments = draft.knxAssignments.filter(
          (a) => a.consumerDeviceId !== consumerId,
        );
        if (channel) draft.knxAssignments.push({ ...channel, consumerDeviceId: consumerId });
      },
    },
  };
}

export function autoAssignChannels(project: Project, boardId: string): Checked {
  const next = autoAssignments(project, boardId);
  if (next.length === 0) return { ok: false, error: "Keine freien Kanäle oder alle zugeordnet" };
  return {
    ok: true,
    command: {
      label: "Kanäle automatisch zuordnen",
      run(draft) {
        draft.knxAssignments.push(...structuredClone(next));
      },
    },
  };
}

export function addKnxLine(line: KnxLine): Command {
  return {
    label: "KNX-Linie anlegen",
    run(draft) {
      draft.knxLines.push(structuredClone(line));
    },
  };
}

export function editKnxLine(
  id: string,
  edit: { label?: string; boardId?: string | null },
): Command {
  return {
    label: "KNX-Linie ändern",
    run(draft) {
      const l = draft.knxLines.find((x) => x.id === id);
      if (!l) return;
      if (edit.label !== undefined) l.label = edit.label;
      if (edit.boardId === null) delete l.boardId;
      else if (edit.boardId !== undefined) l.boardId = edit.boardId;
    },
  };
}

/** Geräte verlieren knxLineId über normalizeAfterCommand. */
export function deleteKnxLine(id: string): Command {
  return {
    label: "KNX-Linie löschen",
    run(draft) {
      draft.knxLines = draft.knxLines.filter((l) => l.id !== id);
    },
  };
}

/** „KNX-Linie zuweisen“ für Busteilnehmer; `null` löst sie von der Linie. */
export function assignKnxLine(
  project: Project,
  deviceIds: readonly string[],
  lineId: string | null,
): Command {
  const ids = new Set(
    project.devices
      .filter((d) => deviceIds.includes(d.id) && isBusParticipant(project, d))
      .map((d) => d.id),
  );
  return {
    label: "KNX-Linie zuweisen",
    run(draft) {
      for (const d of draft.devices) {
        if (!ids.has(d.id)) continue;
        if (lineId === null) delete d.knxLineId;
        else d.knxLineId = lineId;
      }
    },
  };
}

/** „Teilnehmer über Busleitungen zuordnen“: nur Busteilnehmer ohne Linie. */
export function assignLineParticipants(project: Project, lineId: string): Checked {
  const line = project.knxLines.find((l) => l.id === lineId);
  if (!line?.boardId) return { ok: false, error: "Zuerst den Verteiler der Linie wählen" };
  const ids = reachableParticipants(project, line).filter(
    (id) => project.devices.find((d) => d.id === id)?.knxLineId === undefined,
  );
  if (ids.length === 0) return { ok: false, error: "Keine Teilnehmer ohne Linie erreichbar" };
  return {
    ok: true,
    command: {
      ...assignKnxLine(project, ids, lineId),
      label: "Teilnehmer über Busleitungen zuordnen",
    },
  };
}
