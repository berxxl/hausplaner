/**
 * Migrationskette der Schemaversion. Eine Migration hebt die rohen Dateiinhalte
 * (Pfad → geparstes YAML) von Version N auf N + 1.
 * Echte Dateien ohne schemaVersion sind ein Ladefehler; die Migration „0 → 1“ gibt es nur im Test.
 */
import { CURRENT_SCHEMA_VERSION } from "./schema";
import {
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

export function migrationNotice(version: number): string {
  return `Projekt auf Version ${version} aktualisiert, wird beim nächsten Speichern geschrieben`;
}
