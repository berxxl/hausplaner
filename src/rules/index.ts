/** Alle Warnungen des Projekts (berechnet, nie gespeichert). Frei von React. */
import type { Project } from "../model/types";
import { openingsWithoutWall } from "./openings";
import { openingWarnings, roomWarnings, slopeWarnings } from "./building";
import { deviceCoveredWarnings } from "./furniture";
import { deviceWarnings, furnitureWarnings } from "./devices";
import { routeWarnings } from "./routes";
import { cableWarnings } from "./cables";
import { boardWarnings } from "./boards";
import { circuitWarnings } from "./circuits";
import { knxWarnings } from "./knx";

export type WarningTarget =
  | { kind: "room"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "device"; id: string }
  | { kind: "route-node"; id: string }
  | { kind: "route-segment"; id: string }
  | { kind: "cable"; id: string }
  /** Verteiler auswählen; `open` öffnet die Belegung (M4) */
  | { kind: "board"; id: string; open?: boolean }
  /** Reiheneinbaugerät auswählen und die Belegung seines Verteilers öffnen (M4) */
  | { kind: "board-device"; id: string }
  | { kind: "none" };

export interface ProjectWarning {
  /** Stabiler Schlüssel `<regel>:<objektId>`. */
  key: string;
  text: string;
  /** Ziel eines Klicks in der Warnungsleiste (design.md Tabelle „Warnungen“). */
  target: WarningTarget;
  /** Aktion „Löschen“ für Objekte, die nicht dargestellt werden können. */
  deletable?: {
    kind:
      | "opening"
      | "device"
      | "furniture"
      | "route-node"
      | "route-segment"
      | "cable"
      | "board"
      | "circuit";
    id: string;
  };
  /** Aktion „Vom Gerät lösen“ für einen Trassenknoten an einem unbekannten Gerät (design.md M3). */
  detachNode?: string;
  /** Aktion „Vom Verteiler lösen“ für einen Trassenknoten an einem unbekannten Verteiler (M4). */
  detachBoardNode?: string;
}

/** Übergehbar sind alle Warnungen außer Verweisen ins Leere (Aktion „Löschen“ bzw. „Vom Gerät lösen“). */
export const isSuppressible = (w: ProjectWarning): boolean =>
  !w.deletable && !w.detachNode && !w.detachBoardNode;

export function computeWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  for (const w of openingsWithoutWall(project)) {
    const id = w.key.slice("opening-without-wall:".length);
    warnings.push({ ...w, target: { kind: "none" }, deletable: { kind: "opening", id } });
  }
  warnings.push(...roomWarnings(project), ...slopeWarnings(project), ...openingWarnings(project));
  warnings.push(...deviceWarnings(project), ...furnitureWarnings(project));
  warnings.push(...deviceCoveredWarnings(project));
  warnings.push(...routeWarnings(project), ...cableWarnings(project));
  warnings.push(...boardWarnings(project), ...circuitWarnings(project), ...knxWarnings(project));
  return warnings.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
