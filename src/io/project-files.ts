/** Aufteilen und Zusammenführen Project ↔ Dateien. Frei von React. */
import type { Catalog, DeviceType, Project } from "../model/types";
import type { CatalogFile, ProjectFile, StoreyFile, WarningsFile } from "../model/schema";
import { writeYaml } from "./writer";
import { CATALOG_FILE, PROJECT_FILE, storeyFilePath, WARNINGS_FILE } from "./paths";

/** Serialisiert das Projekt in seine Dateien (Pfad → Inhalt). */
export function projectToFiles(project: Project): Record<string, string> {
  const files: Record<string, string> = {};
  const projectFile: ProjectFile = {
    schemaVersion: project.schemaVersion,
    name: project.name,
    settings: project.settings,
  };
  files[PROJECT_FILE] = writeYaml(projectFile, "projectFile");
  for (const storey of project.storeys) {
    const own = <T extends { storeyId: string }>(list: T[]) =>
      list.filter((x) => x.storeyId === storey.id);
    const storeyFile: StoreyFile = {
      storey,
      walls: own(project.walls),
      rooms: own(project.rooms),
      openings: own(project.openings),
      devices: own(project.devices),
      furniture: own(project.furniture),
    };
    files[storeyFilePath(storey.slug)] = writeYaml(storeyFile, "storeyFile");
  }
  // katalog.yaml und warnungen.yaml nur mit Inhalt; sonst fehlt die Datei (= leer)
  const { deviceTypes, lineTypes, furnitureTypes } = project.catalog;
  if (deviceTypes.length + lineTypes.length + furnitureTypes.length > 0) {
    files[CATALOG_FILE] = writeYaml(catalogToFile(project.catalog), "catalogFile");
  }
  if (project.suppressedWarnings.length > 0) {
    const warnings: WarningsFile = { suppressedWarnings: project.suppressedWarnings };
    files[WARNINGS_FILE] = writeYaml(warnings, "warningsFile");
  }
  return files;
}

export function catalogToFile(catalog: Catalog): CatalogFile {
  return {
    deviceTypes: catalog.deviceTypes,
    lineTypes: catalog.lineTypes,
    furnitureTypes: catalog.furnitureTypes,
  };
}

export function catalogFromFile(file: CatalogFile | undefined): Catalog {
  return {
    deviceTypes: (file?.deviceTypes ?? []).map((t): DeviceType => ({
      ...t,
      connects: t.connects ?? [],
    })),
    lineTypes: file?.lineTypes ?? [],
    furnitureTypes: file?.furnitureTypes ?? [],
  };
}

/** Führt geprüfte Dateiinhalte zu einem Project zusammen; setzt storeyId. */
export function filesToProject(
  projectFile: ProjectFile,
  storeyFiles: StoreyFile[],
  catalogFile?: CatalogFile,
  warningsFile?: WarningsFile,
): Project {
  const project: Project = {
    schemaVersion: projectFile.schemaVersion,
    name: projectFile.name,
    settings: projectFile.settings,
    catalog: catalogFromFile(catalogFile),
    storeys: [],
    walls: [],
    rooms: [],
    openings: [],
    devices: [],
    furniture: [],
    suppressedWarnings: warningsFile?.suppressedWarnings ?? [],
  };
  for (const file of storeyFiles) {
    const storeyId = file.storey.id;
    project.storeys.push(file.storey);
    for (const w of file.walls ?? []) project.walls.push({ ...w, storeyId });
    for (const r of file.rooms ?? []) project.rooms.push({ ...r, storeyId });
    for (const o of file.openings ?? []) project.openings.push({ ...o, storeyId });
    for (const d of file.devices ?? []) project.devices.push({ ...d, storeyId });
    for (const f of file.furniture ?? []) project.furniture.push({ ...f, storeyId });
  }
  return project;
}

/** Geschosse in Anzeigereihenfolge: nach Höhenlage, bei Gleichstand nach Name. */
export function sortedStoreys(project: Project): Project["storeys"] {
  return [...project.storeys].sort(
    (a, b) => a.elevationMm - b.elevationMm || a.name.localeCompare(b.name, "de"),
  );
}
