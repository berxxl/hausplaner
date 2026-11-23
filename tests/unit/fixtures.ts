import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse } from "yaml";
import { writeYaml } from "../../src/io/writer";
import { M6_DEVICE_TYPE_IDS } from "../../src/model/default-catalog";
import type { CatalogFile } from "../../src/model/schema";

const ROOT = join(__dirname, "..", "fixtures");

/** Alle *.yaml eines Fixture-Projekts als Pfad → Inhalt, wie GET /api/project sie liefert. */
export function readFixture(name: string): Record<string, string> {
  const dir = join(ROOT, name);
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".yaml"))
        files[relative(dir, p).split(sep).join("/")] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return files;
}

/**
 * Fixture als M5-Projekt (Schemaversion 4, ohne Mindestgefälle, ohne die M6-Standardtypen) für
 * Migrationstests (design.md M6 „Schemaversion 5 und Migration“).
 */
export function readV4Fixture(name: string): Record<string, string> {
  const files = readFixture(name);
  files["projekt.yaml"] = files["projekt.yaml"]!.replace(
    "schemaVersion: 5",
    "schemaVersion: 4",
  ).replace(/ {2}condensateMinSlopePercent: .*\n/, "");
  const catalog = files["katalog.yaml"];
  if (catalog) {
    const file = parse(catalog) as CatalogFile;
    file.deviceTypes = file.deviceTypes?.filter((t) => !M6_DEVICE_TYPE_IDS.includes(t.id));
    files["katalog.yaml"] = writeYaml(file, "catalogFile");
  }
  return files;
}

/** Fixture als M3-Projekt (Schemaversion 3, ohne Reserven und Verteilerzuschlag) für Migrationstests. */
export function readV3Fixture(name: string): Record<string, string> {
  const files = readV4Fixture(name);
  files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 4", "schemaVersion: 3")
    .replace(/ perBoardMm: \d+,/, "")
    .replace(/ {2}teReservePercent: .*\n/, "")
    .replace(/ {2}actuatorReservePercent: .*\n/, "");
  return files;
}

/** Fixture als M2-Projekt (Schemaversion 2, ohne Leitungszuschläge) für Migrationstests. */
export function readV2Fixture(name: string): Record<string, string> {
  const files = readV3Fixture(name);
  files["projekt.yaml"] = files["projekt.yaml"]!.replace(
    "schemaVersion: 3",
    "schemaVersion: 2",
  ).replace(/ {2}lengthAllowance: .*\n/, "");
  return files;
}

/** Fixture als M1-Projekt (Schemaversion 1, ohne Installationszonen) für Migrationstests. */
export function readV1Fixture(name: string): Record<string, string> {
  const files = readV2Fixture(name);
  files["projekt.yaml"] = files["projekt.yaml"]!.replace(
    "schemaVersion: 2",
    "schemaVersion: 1",
  ).replace(/ {2}installZones:\n( {4}.*\n)+/, "");
  return files;
}
