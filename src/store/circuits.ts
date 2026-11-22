/**
 * Befehle für Stromkreise (design.md M4 „Stromkreise“). Leitungen gehören abgeleitet zum
 * Stromkreis, daher kein eigener Befehl für sie. Frei von React.
 */
import { isCircuitDevice } from "../geometry/circuits";
import type { Circuit, Project } from "../model/types";
import type { Checked } from "./catalog";
import type { Command } from "./history";

function check(project: Project, c: Circuit): string | null {
  if (!c.label.trim()) return "Bezeichnung fehlt";
  if (!project.boards.some((b) => b.id === c.boardId)) return "Verteiler nicht gefunden";
  if (c.protectionDeviceId !== undefined) {
    const d = project.devices.find((x) => x.id === c.protectionDeviceId);
    if (!d || d.placement.kind !== "board" || d.placement.boardId !== c.boardId)
      return "Schutzgerät muss im selben Verteiler stehen";
  }
  if (c.lineTypeId !== undefined) {
    const t = project.catalog.lineTypes.find((x) => x.id === c.lineTypeId);
    if (!t || t.trade !== "power") return "Leitungstyp des Gewerks Strom wählen";
  }
  return null;
}

export function addCircuit(project: Project, circuit: Circuit): Checked {
  const error = check(project, circuit);
  if (error) return { ok: false, error };
  return {
    ok: true,
    command: {
      label: "Stromkreis anlegen",
      run(draft) {
        draft.circuits.push(structuredClone(circuit));
      },
    },
  };
}

export type CircuitEdit = Partial<Pick<Circuit, "label" | "protectionDeviceId" | "lineTypeId">>;

/** „Stromkreis ändern“; `undefined` in protectionDeviceId/lineTypeId entfernt den Wert. */
export function editCircuit(project: Project, id: string, edit: CircuitEdit): Checked {
  const c = project.circuits.find((x) => x.id === id);
  if (!c) return { ok: false, error: "Stromkreis nicht gefunden" };
  const next: Circuit = { ...c, ...edit };
  for (const k of ["protectionDeviceId", "lineTypeId"] as const)
    if (k in edit && edit[k] === undefined) delete next[k];
  const error = check(project, next);
  if (error) return { ok: false, error };
  return {
    ok: true,
    command: {
      label: "Stromkreis ändern",
      run(draft) {
        const i = draft.circuits.findIndex((x) => x.id === id);
        if (i >= 0) draft.circuits[i] = structuredClone(next);
      },
    },
  };
}

/** „Stromkreis löschen“: die Geräte verlieren circuitId (normalizeAfterCommand). */
export function deleteCircuit(id: string): Command {
  return {
    label: "Stromkreis löschen",
    run(draft) {
      draft.circuits = draft.circuits.filter((c) => c.id !== id);
    },
  };
}

/**
 * „Stromkreis zuweisen“ für mehrere Geräte in einem Schritt; gilt nur für Geräte des Gewerks Strom
 * außerhalb von Verteilern. `null` löst die Geräte vom Stromkreis.
 */
export function assignCircuit(
  project: Project,
  deviceIds: readonly string[],
  circuitId: string | null,
): Command {
  const ids = new Set(
    project.devices
      .filter((d) => deviceIds.includes(d.id) && isCircuitDevice(project, d))
      .map((d) => d.id),
  );
  return {
    label: "Stromkreis zuweisen",
    run(draft) {
      for (const d of draft.devices) {
        if (!ids.has(d.id)) continue;
        if (circuitId === null) delete d.circuitId;
        else d.circuitId = circuitId;
      }
    },
  };
}
