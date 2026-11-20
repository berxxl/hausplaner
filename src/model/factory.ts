/** Neue Objekte mit Standardwerten (design.md „Neues Projekt“). */
import { CURRENT_SCHEMA_VERSION } from "./schema";
import { newId } from "./ids";
import { uniqueSlug } from "./slug";
import type { Project, Storey } from "./types";

export const FIRST_STOREY_DEFAULTS = {
  elevationMm: 0,
  rawHeightMm: 2500,
  defaults: { floorBuildupMm: 120, plasterMm: 15, suspendedMm: 0 },
} as const;

export function newProject(name: string, firstStoreyName = "EG"): Project {
  const storey: Storey = {
    id: newId(),
    name: firstStoreyName,
    slug: uniqueSlug(firstStoreyName, new Set()),
    elevationMm: FIRST_STOREY_DEFAULTS.elevationMm,
    rawHeightMm: FIRST_STOREY_DEFAULTS.rawHeightMm,
    defaults: { ...FIRST_STOREY_DEFAULTS.defaults },
  };
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    settings: { northDeg: 0 },
    storeys: [storey],
    walls: [],
    rooms: [],
    openings: [],
  };
}
