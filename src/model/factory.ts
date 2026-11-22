/** Neue Objekte mit Standardwerten (design.md „Neues Projekt“). */
import { CURRENT_SCHEMA_VERSION } from "./schema";
import { DEFAULT_LENGTH_ALLOWANCE, DEFAULT_INSTALL_ZONES, defaultCatalog } from "./default-catalog";
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
    settings: {
      northDeg: 0,
      installZones: structuredClone(DEFAULT_INSTALL_ZONES),
      lengthAllowance: { ...DEFAULT_LENGTH_ALLOWANCE },
    },
    catalog: defaultCatalog(),
    storeys: [storey],
    walls: [],
    rooms: [],
    openings: [],
    devices: [],
    furniture: [],
    routeNodes: [],
    routeSegments: [],
    cables: [],
    suppressedWarnings: [],
  };
}

/** Abstand zwischen Rohdecke des höchsten Geschosses und Rohfußboden des nächsten (design.md „Weiteres Geschoss“). */
export const CEILING_THICKNESS_MM = 300;

export interface StoreySuggestion {
  elevationMm: number;
  rawHeightMm: number;
  defaults: Storey["defaults"];
}

/** Vorschlag für ein weiteres Geschoss aus dem höchsten Geschoss (größte Höhenlage). */
export function suggestNextStorey(project: Project): StoreySuggestion {
  const highest = [...project.storeys].sort(
    (a, b) => b.elevationMm - a.elevationMm || b.name.localeCompare(a.name, "de"),
  )[0];
  if (!highest) {
    return {
      elevationMm: FIRST_STOREY_DEFAULTS.elevationMm,
      rawHeightMm: FIRST_STOREY_DEFAULTS.rawHeightMm,
      defaults: { ...FIRST_STOREY_DEFAULTS.defaults },
    };
  }
  return {
    elevationMm: highest.elevationMm + highest.rawHeightMm + CEILING_THICKNESS_MM,
    rawHeightMm: highest.rawHeightMm,
    defaults: { ...highest.defaults },
  };
}

/** Neues Geschoss mit einmalig gebildetem, eindeutigem Slug. */
export function newStorey(project: Project, name: string, values: StoreySuggestion): Storey {
  const ids = new Set(allIds(project));
  return {
    id: newId(ids),
    name,
    slug: uniqueSlug(name, new Set(project.storeys.map((s) => s.slug))),
    elevationMm: values.elevationMm,
    rawHeightMm: values.rawHeightMm,
    defaults: { ...values.defaults },
  };
}

/** Alle IDs des Projekts (projektweit eindeutig), einschließlich Katalog. */
export function allIds(project: Project): string[] {
  const { deviceTypes, lineTypes, furnitureTypes } = project.catalog;
  return [
    ...project.storeys.map((s) => s.id),
    ...project.walls.map((w) => w.id),
    ...project.rooms.flatMap((r) => [r.id, ...(r.slopes ?? []).map((s) => s.id)]),
    ...project.openings.map((o) => o.id),
    ...project.devices.map((d) => d.id),
    ...project.furniture.map((f) => f.id),
    ...deviceTypes.map((t) => t.id),
    ...lineTypes.map((t) => t.id),
    ...furnitureTypes.map((t) => t.id),
  ];
}
