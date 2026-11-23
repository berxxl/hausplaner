/**
 * Migrationskette der Schemaversion. Eine Migration hebt die rohen Dateiinhalte
 * (Pfad → geparstes YAML) von Version N auf N + 1.
 * Echte Dateien ohne schemaVersion sind ein Ladefehler; die Migration „0 → 1“ gibt es nur im Test.
 */
import { CURRENT_SCHEMA_VERSION } from "./schema";
import {
  DEFAULT_ACTUATOR_RESERVE_PERCENT,
  DEFAULT_CONDENSATE_MIN_SLOPE_PERCENT,
  M6_DEVICE_TYPE_IDS,
  DEFAULT_TE_RESERVE_PERCENT,
  M4_DEVICE_TYPE_IDS,
  M4_LINE_TYPE_IDS,
  DEFAULT_LENGTH_ALLOWANCE,
  DEFAULT_DEVICE_TYPES,
  DEFAULT_FURNITURE_TYPES,
  DEFAULT_INSTALL_ZONES,
  DEFAULT_LINE_TYPES,
} from "./default-catalog";

export type RawFiles = Record<string, unknown>;
export type Migration = (files: RawFiles) => RawFiles;

const registry = new Map<number, Migration>();

export function registerMigration(fromVersion: number, migration: Migration): void {
  registry.set(fromVersion, migration);
}

export function unregisterMigration(fromVersion: number): void {
  registry.delete(fromVersion);
}

export function hasMigration(fromVersion: number): boolean {
  return registry.has(fromVersion);
}

/** Wendet alle Migrationen von `from` bis zur aktuellen Version an. Wirft, wenn ein Schritt fehlt. */
export function migrate(files: RawFiles, from: number): RawFiles {
  let current = files;
  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = registry.get(v);
    if (!step) throw new Error(`Keine Migration von Version ${v} auf ${v + 1}`);
    current = step(current);
  }
  return current;
}

/**
 * 1 → 2 (design.md M2 „Schemaversion 2 und Migration“): Standardzonen, Standardkatalog,
 * wenn katalog.yaml fehlt. Geschossdateien bleiben unverändert.
 */
export function migrateV1toV2(files: RawFiles): RawFiles {
  const next: RawFiles = { ...files };
  const project = structuredClone(files["projekt.yaml"]) as Record<string, unknown>;
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  project.settings = { ...settings, installZones: structuredClone(DEFAULT_INSTALL_ZONES) };
  project.schemaVersion = 2;
  next["projekt.yaml"] = project;
  if (!("katalog.yaml" in files)) {
    next["katalog.yaml"] = structuredClone({
      deviceTypes: DEFAULT_DEVICE_TYPES,
      lineTypes: DEFAULT_LINE_TYPES,
      furnitureTypes: DEFAULT_FURNITURE_TYPES,
    });
  }
  return next;
}
registerMigration(1, migrateV1toV2);

/** 2 → 3 (design.md M3 „Schemaversion 3 und Migration“): Standardzuschläge für Leitungslängen. */
export function migrateV2toV3(files: RawFiles): RawFiles {
  const project = structuredClone(files["projekt.yaml"]) as Record<string, unknown>;
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const { perBoardMm: _perBoard, ...allowance } = DEFAULT_LENGTH_ALLOWANCE;
  void _perBoard;
  project.settings = { ...settings, lengthAllowance: allowance };
  project.schemaVersion = 3;
  return { ...files, "projekt.yaml": project };
}
registerMigration(2, migrateV2toV3);

/**
 * 3 → 4 (design.md M4 „Schemaversion 4 und Migration“): Reserven, Verteilerzuschlag und die
 * neuen Standardtypen, deren ID im Projektkatalog fehlt. Vorhandene Typen bleiben unverändert.
 */
export function migrateV3toV4(files: RawFiles): RawFiles {
  const next: RawFiles = { ...files };
  const project = structuredClone(files["projekt.yaml"]) as Record<string, unknown>;
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const allowance = (settings.lengthAllowance ?? {}) as Record<string, unknown>;
  project.settings = {
    ...settings,
    lengthAllowance: { ...allowance, perBoardMm: DEFAULT_LENGTH_ALLOWANCE.perBoardMm },
    teReservePercent: DEFAULT_TE_RESERVE_PERCENT,
    actuatorReservePercent: DEFAULT_ACTUATOR_RESERVE_PERCENT,
  };
  project.schemaVersion = 4;
  next["projekt.yaml"] = project;
  const raw = files["katalog.yaml"];
  // Ohne katalog.yaml gilt der Katalog als leer (bewusst geleert); dann nichts ergänzen.
  if (raw && typeof raw === "object") {
    const catalog = structuredClone(raw) as Record<string, unknown>;
    addMissingTypes(catalog, "deviceTypes", DEFAULT_DEVICE_TYPES, M4_DEVICE_TYPE_IDS);
    addMissingTypes(catalog, "lineTypes", DEFAULT_LINE_TYPES, M4_LINE_TYPE_IDS);
    next["katalog.yaml"] = catalog;
  }
  return next;
}
registerMigration(3, migrateV3toV4);

/** Hängt Standardtypen an, deren ID im Katalog fehlt; vorhandene Typen bleiben unverändert. */
function addMissingTypes<T extends { id: string }>(
  catalog: Record<string, unknown>,
  key: string,
  defaults: T[],
  ids: string[],
) {
  const list = Array.isArray(catalog[key]) ? (catalog[key] as { id?: unknown }[]) : [];
  const have = new Set(list.map((t) => t.id));
  const missing = defaults.filter((t) => ids.includes(t.id) && !have.has(t.id));
  if (missing.length > 0) catalog[key] = [...list, ...structuredClone(missing)];
}

/**
 * 4 → 5 (design.md M6 „Schemaversion 5 und Migration“): Mindestgefälle für Kondensat und die
 * neuen Standardtypen Kondensatablauf und Multisplit-Außengerät. Vorhandene Typen bleiben
 * unverändert; ihre Klimarolle wird abgeleitet (`refrigerantUnit`).
 */
export function migrateV4toV5(files: RawFiles): RawFiles {
  const next: RawFiles = { ...files };
  const project = structuredClone(files["projekt.yaml"]) as Record<string, unknown>;
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  project.settings = {
    ...settings,
    condensateMinSlopePercent: DEFAULT_CONDENSATE_MIN_SLOPE_PERCENT,
  };
  project.schemaVersion = 5;
  next["projekt.yaml"] = project;
  const raw = files["katalog.yaml"];
  if (raw && typeof raw === "object") {
    const catalog = structuredClone(raw) as Record<string, unknown>;
    addMissingTypes(catalog, "deviceTypes", DEFAULT_DEVICE_TYPES, M6_DEVICE_TYPE_IDS);
    next["katalog.yaml"] = catalog;
  }
  return next;
}
registerMigration(4, migrateV4toV5);

export function migrationNotice(version: number): string {
  return `Projekt auf Version ${version} aktualisiert, wird beim nächsten Speichern geschrieben`;
}
