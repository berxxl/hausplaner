/** Aufteilen und Zusammenführen Project ↔ Dateien. Frei von React. */
import type { Catalog, DeviceType, Project } from "../model/types";
import type {
  BoardsFile,
  CablesFile,
  CatalogFile,
  ProjectFile,
  StoreyFile,
  ViewsFile,
  WarningsFile,
} from "../model/schema";
import { writeYaml } from "./writer";
import {
  BOARDS_FILE,
  CABLES_FILE,
  CATALOG_FILE,
  PROJECT_FILE,
  storeyFilePath,
  VIEWS_FILE,
  WARNINGS_FILE,
} from "./paths";

/** Reiheneinbaugeräte stehen in verteiler.yaml, alle anderen Geräte in den Geschossdateien. */
const inBoard = (d: Project["devices"][number]) => d.placement.kind === "board";

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
      roomBoundaries: own(project.roomBoundaries),
      rooms: own(project.rooms),
      openings: own(project.openings),
      devices: own(project.devices).filter((d) => !inBoard(d)),
      furniture: own(project.furniture),
      routeNodes: own(project.routeNodes),
      routeSegments: own(project.routeSegments),
    };
    files[storeyFilePath(storey.slug)] = writeYaml(storeyFile, "storeyFile");
  }
  // katalog.yaml, warnungen.yaml und leitungen.yaml nur mit Inhalt; sonst fehlt die Datei (= leer)
  const { deviceTypes, lineTypes, furnitureTypes } = project.catalog;
  if (deviceTypes.length + lineTypes.length + furnitureTypes.length > 0) {
    files[CATALOG_FILE] = writeYaml(catalogToFile(project.catalog), "catalogFile");
  }
  if (project.suppressedWarnings.length > 0) {
    const warnings: WarningsFile = { suppressedWarnings: project.suppressedWarnings };
    files[WARNINGS_FILE] = writeYaml(warnings, "warningsFile");
  }
  if (project.cables.length > 0) {
    const cables: CablesFile = { cables: project.cables };
    files[CABLES_FILE] = writeYaml(cables, "cablesFile");
  }
  // verteiler.yaml nur mit Inhalt (design.md M4 „Dateiformat M4“)
  const boardDevices = project.devices.filter(inBoard);
  if (
    project.boards.length +
      boardDevices.length +
      project.circuits.length +
      project.knxLines.length +
      project.knxAssignments.length >
    0
  ) {
    const boards = {
      boards: project.boards,
      devices: boardDevices,
      circuits: project.circuits,
      knxLines: project.knxLines,
      knxAssignments: project.knxAssignments,
    } as unknown as BoardsFile;
    files[BOARDS_FILE] = writeYaml(boards, "boardsFile");
  }
  // ansichten.yaml nur mit Inhalt (design.md M6 „Dateiformat M5“)
  if (project.cameraViews.length > 0) {
    const views: ViewsFile = { cameraViews: project.cameraViews };
    files[VIEWS_FILE] = writeYaml(views, "viewsFile");
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
  cablesFile?: CablesFile,
  boardsFile?: BoardsFile,
  viewsFile?: ViewsFile,
): Project {
  const project: Project = {
    schemaVersion: projectFile.schemaVersion,
    name: projectFile.name,
    settings: projectFile.settings,
    catalog: catalogFromFile(catalogFile),
    storeys: [],
    walls: [],
    roomBoundaries: [],
    rooms: [],
    openings: [],
    devices: [],
    furniture: [],
    routeNodes: [],
    routeSegments: [],
    cables: (cablesFile?.cables ?? []).map((c) => ({ ...c, path: c.path ?? [] })),
    boards: [],
    circuits: boardsFile?.circuits ?? [],
    knxLines: boardsFile?.knxLines ?? [],
    knxAssignments: boardsFile?.knxAssignments ?? [],
    suppressedWarnings: warningsFile?.suppressedWarnings ?? [],
    cameraViews: viewsFile?.cameraViews ?? [],
  };
  for (const file of storeyFiles) {
    const storeyId = file.storey.id;
    project.storeys.push(file.storey);
    for (const w of file.walls ?? []) project.walls.push({ ...w, storeyId });
    for (const b of file.roomBoundaries ?? []) project.roomBoundaries.push({ ...b, storeyId });
    for (const r of file.rooms ?? []) project.rooms.push({ ...r, storeyId });
    for (const o of file.openings ?? []) project.openings.push({ ...o, storeyId });
    for (const d of file.devices ?? []) project.devices.push({ ...d, storeyId });
    for (const f of file.furniture ?? []) project.furniture.push({ ...f, storeyId });
    for (const n of file.routeNodes ?? []) project.routeNodes.push({ ...n, storeyId });
    for (const s of file.routeSegments ?? []) project.routeSegments.push({ ...s, storeyId });
  }
  // Verteiler: Geschoss der Wand; ohne Wand (Verweis ins Leere) das erste Geschoss der Dateien
  const fallback = project.storeys[0]?.id ?? "";
  const wallStorey = new Map(project.walls.map((w) => [w.id, w.storeyId]));
  for (const b of boardsFile?.boards ?? []) {
    const wallId = b.placement.surface.split(":")[1]!;
    project.boards.push({
      ...b,
      fields: b.fields ?? [],
      storeyId: wallStorey.get(wallId) ?? fallback,
    });
  }
  const boardStorey = new Map(project.boards.map((b) => [b.id, b.storeyId]));
  for (const d of boardsFile?.devices ?? []) {
    const boardId = d.placement.kind === "board" ? d.placement.boardId : "";
    project.devices.push({ ...d, storeyId: boardStorey.get(boardId) ?? fallback });
  }
  return project;
}

/** Geschosse in Anzeigereihenfolge: nach Höhenlage, bei Gleichstand nach Name. */
export function sortedStoreys(project: Project): Project["storeys"] {
  return [...project.storeys].sort(
    (a, b) => a.elevationMm - b.elevationMm || a.name.localeCompare(b.name, "de"),
  );
}
