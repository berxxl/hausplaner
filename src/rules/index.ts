/** Alle Warnungen des Projekts (berechnet, nie gespeichert). Frei von React. */
import type { Project } from "../model/types";
import { openingsWithoutWall } from "./openings";
import { openingWarnings, roomWarnings, slopeWarnings } from "./building";
import { deviceCoveredWarnings } from "./furniture";
import { deviceWarnings, furnitureWarnings } from "./devices";

export type WarningTarget =
  | { kind: "room"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "device"; id: string }
  | { kind: "none" };

export interface ProjectWarning {
  /** Stabiler Schlüssel `<regel>:<objektId>`. */
  key: string;
  text: string;
  /** Ziel eines Klicks in der Warnungsleiste (design.md Tabelle „Warnungen“). */
  target: WarningTarget;
  /** Aktion „Löschen“ für Objekte, die nicht dargestellt werden können. */
  deletable?: { kind: "opening" | "device" | "furniture"; id: string };
}

/** Übergehbar sind alle Warnungen außer Verweisen ins Leere (die mit Aktion „Löschen“). */
export const isSuppressible = (w: ProjectWarning): boolean => !w.deletable;

export function computeWarnings(project: Project): ProjectWarning[] {
  const warnings: ProjectWarning[] = [];
  for (const w of openingsWithoutWall(project)) {
    const id = w.key.slice("opening-without-wall:".length);
    warnings.push({ ...w, target: { kind: "none" }, deletable: { kind: "opening", id } });
  }
  warnings.push(...roomWarnings(project), ...slopeWarnings(project), ...openingWarnings(project));
  warnings.push(...deviceWarnings(project), ...furnitureWarnings(project));
  warnings.push(...deviceCoveredWarnings(project));
  return warnings.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
