/** Aufteilen und Zusammenführen Project ↔ Dateien. Frei von React. */
import type { Project } from "../model/types";
import type { ProjectFile, StoreyFile } from "../model/schema";
import { writeYaml } from "./writer";
import { PROJECT_FILE, storeyFilePath } from "./paths";

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
    };
    files[storeyFilePath(storey.slug)] = writeYaml(storeyFile, "storeyFile");
  }
  return files;
}

/** Führt geprüfte Dateiinhalte zu einem Project zusammen; setzt storeyId. */
export function filesToProject(projectFile: ProjectFile, storeyFiles: StoreyFile[]): Project {
  const project: Project = {
    schemaVersion: projectFile.schemaVersion,
    name: projectFile.name,
    settings: projectFile.settings,
    storeys: [],
    walls: [],
    rooms: [],
    openings: [],
  };
  for (const file of storeyFiles) {
    const storeyId = file.storey.id;
    project.storeys.push(file.storey);
    for (const w of file.walls ?? []) project.walls.push({ ...w, storeyId });
    for (const r of file.rooms ?? []) project.rooms.push({ ...r, storeyId });
    for (const o of file.openings ?? []) project.openings.push({ ...o, storeyId });
  }
  return project;
}

/** Geschosse in Anzeigereihenfolge: nach Höhenlage, bei Gleichstand nach Name. */
export function sortedStoreys(project: Project): Project["storeys"] {
  return [...project.storeys].sort(
    (a, b) => a.elevationMm - b.elevationMm || a.name.localeCompare(b.name, "de"),
  );
}
