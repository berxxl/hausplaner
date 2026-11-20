/**
 * Migrationskette der Schemaversion. Eine Migration hebt die rohen Dateiinhalte
 * (Pfad → geparstes YAML) von Version N auf N + 1.
 * Echte Dateien ohne schemaVersion sind ein Ladefehler; die Migration „0 → 1“ gibt es nur im Test.
 */
import { CURRENT_SCHEMA_VERSION } from "./schema";

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

export function migrationNotice(version: number): string {
  return `Projekt auf Version ${version} aktualisiert, wird beim nächsten Speichern geschrieben`;
}
