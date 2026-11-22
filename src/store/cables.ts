/**
 * Befehle für Leitungen (design.md M3 „Leitungen“). Prüfungen vorab mit `Checked` wie beim Katalog:
 * abgelehnte Schritte landen nie in der Undo-Historie. Frei von React.
 */
import {
  compatibleLineTypes,
  endpointLabel,
  endpointTrades,
  orderChain,
  suggestPath,
} from "../geometry/cables";
import type { Cable, Endpoint, LengthAllowance, Project } from "../model/types";
import type { Checked } from "./catalog";
import type { Command } from "./history";

function tradesText(project: Project, ep: Endpoint): string {
  const trades = endpointTrades(project, ep);
  return trades.length > 0 ? trades.map((c) => TRADE_TEXT[c]).join(", ") : "nichts";
}

const TRADE_TEXT: Record<string, string> = {
  power: "Strom",
  knx: "KNX",
  data: "Daten",
  conduit: "Leerrohr",
  refrigerant: "Kältemittel",
  condensate: "Kondensat",
  other: "Sonstiges",
};

/** „Keine passende Leitung: <Gerät 1> schließt <Gewerke> an, <Gerät 2> <Gewerke>“ */
export function noMatchingLineMessage(project: Project, a: Endpoint, b: Endpoint): string {
  return `Keine passende Leitung: ${endpointLabel(project, a)} schließt ${tradesText(project, a)} an, ${endpointLabel(project, b)} ${tradesText(project, b)}`;
}

/** Prüft den Leitungstyp gegen beide Endpunkte. */
function typeCheck(project: Project, lineTypeId: string, a: Endpoint, b: Endpoint): string | null {
  return compatibleLineTypes(project, a, b).some((t) => t.id === lineTypeId)
    ? null
    : noMatchingLineMessage(project, a, b);
}

/** „Leitung anlegen“ mit Typprüfung und Wegvorschlag. */
export function addCable(project: Project, cable: Omit<Cable, "path" | "status">): Checked {
  const error = typeCheck(project, cable.lineTypeId, cable.from, cable.to);
  if (error) return { ok: false, error };
  const path = suggestPath(project, cable.from, cable.to);
  return {
    ok: true,
    command: {
      label: "Leitung anlegen",
      run(draft) {
        draft.cables.push({ ...structuredClone(cable), status: "planned", path });
      },
    },
  };
}

export type CableEdit = Partial<Pick<Cable, "label" | "lineTypeId" | "status" | "from" | "to">>;

/** „Leitung ändern“; Typ und Endpunkte werden erneut geprüft. */
export function editCable(project: Project, id: string, edit: CableEdit): Checked {
  const c = project.cables.find((x) => x.id === id);
  if (!c) return { ok: false, error: "Leitung nicht gefunden" };
  const next = { ...c, ...edit };
  if (edit.lineTypeId !== undefined || edit.from !== undefined || edit.to !== undefined) {
    const error = typeCheck(project, next.lineTypeId, next.from, next.to);
    if (error) return { ok: false, error };
  }
  return {
    ok: true,
    command: {
      label: "Leitung ändern",
      run(draft) {
        const x = draft.cables.find((y) => y.id === id);
        if (x) Object.assign(x, structuredClone(edit));
      },
    },
  };
}

/** „Weg ändern“: gewählte Segmente als Kette ordnen; ohne Kette in gegebener Reihenfolge. */
export function setCablePath(project: Project, id: string, segmentIds: readonly string[]): Command {
  const c = project.cables.find((x) => x.id === id);
  const ordered = c ? orderChain(project, c, segmentIds) : null;
  const path = ordered ?? [...segmentIds];
  return {
    label: "Weg ändern",
    run(draft) {
      const x = draft.cables.find((y) => y.id === id);
      if (x) x.path = path;
    },
  };
}

/** „Weg vorschlagen“: ersetzt den Weg durch den kürzesten. */
export function suggestCablePath(project: Project, id: string): Command {
  const c = project.cables.find((x) => x.id === id);
  const path = c ? suggestPath(project, c.from, c.to) : [];
  return {
    label: "Weg vorschlagen",
    run(draft) {
      const x = draft.cables.find((y) => y.id === id);
      if (x) x.path = path;
    },
  };
}

export function deleteCables(ids: readonly string[]): Command {
  const set = new Set(ids);
  return {
    label: "Leitung löschen",
    run(draft) {
      draft.cables = draft.cables.filter((c) => !set.has(c.id));
    },
  };
}

/** Aktion „Vom Gerät lösen“ der Warnung `route-node-without-device`. */
export function detachNode(nodeId: string): Command {
  return {
    label: "Vom Gerät lösen",
    run(draft) {
      const n = draft.routeNodes.find((x) => x.id === nodeId);
      if (n) delete n.deviceId;
    },
  };
}

/** „Leitungszuschläge ändern“ mit Prüfung ≥ 0. */
export function setLengthAllowance(allowance: LengthAllowance): Checked {
  if (allowance.perDeviceMm < 0 || allowance.perBoardMm < 0 || allowance.wastePercent < 0)
    return { ok: false, error: "Zuschläge dürfen nicht negativ sein" };
  return {
    ok: true,
    command: {
      label: "Leitungszuschläge ändern",
      run(draft) {
        draft.settings.lengthAllowance = { ...allowance };
      },
    },
  };
}
