/**
 * Laden mit Prüfung (design.md „Ladefehler“). Bekommt die Dateiinhalte (Pfad → Text),
 * wie sie GET /api/project liefert, und gibt Projekt oder Fehlerliste zurück. Frei von React.
 */
import { isMap, isSeq, LineCounter, parseDocument, type Document } from "yaml";
import type { z } from "zod";
import {
  CablesFileSchema,
  CatalogFileSchema,
  CURRENT_SCHEMA_VERSION,
  ProjectFileSchema,
  StoreyFileSchema,
  WarningsFileSchema,
  type CablesFile,
  type CatalogFile,
  type ProjectFile,
  type StoreyFile,
  type WarningsFile,
} from "../model/schema";
import { hasMigration, migrate, migrationNotice, type RawFiles } from "../model/migrations";
import type { Project } from "../model/types";
import { filesToProject } from "./project-files";
import {
  CABLES_FILE,
  CATALOG_FILE,
  isKnownFile,
  PROJECT_FILE,
  storeySlugFromPath,
  WARNINGS_FILE,
} from "./paths";

export interface LoadError {
  file: string;
  /** 1-basiert; fehlt, wenn sich der Fehler auf die ganze Datei bezieht. */
  line?: number;
  message: string;
}

export type LoadResult =
  | { status: "empty" }
  | { status: "error"; errors: LoadError[] }
  | {
      status: "ok";
      project: Project;
      /** Gelesener Inhalt je bekannter Datei, Grundlage für den Vergleich beim Speichern. */
      contents: Record<string, string>;
      /** Hinweis nach einer Migration. */
      notice?: string;
    };

type Segment = string | number;

interface ParsedFile {
  path: string;
  doc: Document;
  lines: LineCounter;
}

const CONFLICT_MARKER = /^(<<<<<<<|=======|>>>>>>>)/;

function conflictErrors(path: string, text: string): LoadError[] {
  const errors: LoadError[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (CONFLICT_MARKER.test(line)) {
      errors.push({
        file: path,
        line: i + 1,
        message: `Merge-Konfliktmarker „${line.slice(0, 7)}“`,
      });
    }
  });
  return errors;
}

/** Zeile des Knotens unter `path`; bei `atKey` die Zeile des Schlüssels selbst. */
function lineOf(file: ParsedFile, path: readonly Segment[], atKey = false): number | undefined {
  let node: unknown = file.doc.contents;
  let offset: number | undefined = rangeStart(node);
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    const last = i === path.length - 1;
    if (isMap(node)) {
      const pair = node.items.find((p) => (p.key as { value?: unknown })?.value === seg);
      if (!pair) break;
      if (last && atKey) {
        offset = rangeStart(pair.key) ?? offset;
        break;
      }
      node = pair.value;
    } else if (isSeq(node) && typeof seg === "number") {
      node = node.items[seg];
    } else {
      break;
    }
    offset = rangeStart(node) ?? offset;
  }
  return offset === undefined ? undefined : file.lines.linePos(offset).line;
}

function rangeStart(node: unknown): number | undefined {
  const range = (node as { range?: [number, number, number] } | null)?.range;
  return range?.[0];
}

function pathText(path: readonly PropertyKey[]): string {
  let s = "";
  for (const seg of path)
    s += typeof seg === "number" ? `[${seg}]` : s ? `.${String(seg)}` : String(seg);
  return s;
}

function issueMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "unrecognized_keys":
      return `Unbekanntes Feld ${issue.keys.map((k) => `„${k}“`).join(", ")}`;
    case "invalid_type":
      return issue.input === undefined
        ? "Pflichtfeld fehlt"
        : `Falscher Typ, erwartet ${issue.expected}`;
    case "invalid_value":
      return `Ungültiger Wert, erlaubt: ${issue.values.map((v) => JSON.stringify(v)).join(", ")}`;
    default:
      return issue.message;
  }
}

/** `file` fehlt bei Dateien, die erst eine Migration erzeugt hat (keine Zeilennummern). */
function schemaErrors(
  filePath: string,
  file: ParsedFile | undefined,
  error: z.ZodError,
): LoadError[] {
  return error.issues.map((issue) => {
    const path = issue.path.filter((s): s is Segment => typeof s !== "symbol");
    const unknownKey = issue.code === "unrecognized_keys" ? issue.keys[0] : undefined;
    const line = !file
      ? undefined
      : unknownKey !== undefined
        ? lineOf(file, [...path, unknownKey], true)
        : lineOf(file, path);
    const where = pathText(issue.path);
    return {
      file: filePath,
      line,
      message: `Schemaverstoß${where ? ` bei ${where}` : ""}: ${issueMessage(issue)}`,
    };
  });
}

function storeyFileIds(file: StoreyFile): { id: string; path: Segment[] }[] {
  const ids: { id: string; path: Segment[] }[] = [{ id: file.storey.id, path: ["storey", "id"] }];
  file.walls?.forEach((w, i) => ids.push({ id: w.id, path: ["walls", i, "id"] }));
  file.rooms?.forEach((r, i) => {
    ids.push({ id: r.id, path: ["rooms", i, "id"] });
    r.slopes?.forEach((s, j) => ids.push({ id: s.id, path: ["rooms", i, "slopes", j, "id"] }));
  });
  file.openings?.forEach((o, i) => ids.push({ id: o.id, path: ["openings", i, "id"] }));
  file.devices?.forEach((d, i) => ids.push({ id: d.id, path: ["devices", i, "id"] }));
  file.furniture?.forEach((f, i) => ids.push({ id: f.id, path: ["furniture", i, "id"] }));
  file.routeNodes?.forEach((n, i) => ids.push({ id: n.id, path: ["routeNodes", i, "id"] }));
  file.routeSegments?.forEach((x, i) => ids.push({ id: x.id, path: ["routeSegments", i, "id"] }));
  return ids;
}

function catalogFileIds(file: CatalogFile): { id: string; path: Segment[] }[] {
  const ids: { id: string; path: Segment[] }[] = [];
  for (const list of ["deviceTypes", "lineTypes", "furnitureTypes"] as const)
    file[list]?.forEach((t, i) => ids.push({ id: t.id, path: [list, i, "id"] }));
  return ids;
}

export function loadProject(allFiles: Record<string, string>): LoadResult {
  // Nur bekannte Dateien (projekt.yaml, katalog.yaml, warnungen.yaml, geschosse/*.yaml).
  const paths = Object.keys(allFiles).filter(isKnownFile).sort();
  const storeyPaths = paths.filter((p) => storeySlugFromPath(p) !== null);
  const hasProjectFile = paths.includes(PROJECT_FILE);
  if (!hasProjectFile && storeyPaths.length === 0) return { status: "empty" };
  if (!hasProjectFile) {
    return {
      status: "error",
      errors: [
        {
          file: PROJECT_FILE,
          message: "projekt.yaml fehlt, obwohl Geschossdateien vorhanden sind",
        },
      ],
    };
  }

  const errors: LoadError[] = [];
  const parsed = new Map<string, ParsedFile>();
  const contents: Record<string, string> = {};
  for (const path of paths) {
    const text = allFiles[path] ?? "";
    contents[path] = text;
    const conflicts = conflictErrors(path, text);
    if (conflicts.length > 0) {
      errors.push(...conflicts);
      continue;
    }
    const lines = new LineCounter();
    const doc = parseDocument(text, { lineCounter: lines, prettyErrors: false });
    if (doc.errors.length > 0) {
      for (const e of doc.errors) {
        errors.push({
          file: path,
          line: lines.linePos(e.pos[0]).line,
          message: `YAML-Syntaxfehler: ${e.message.split("\n")[0]}`,
        });
      }
      continue;
    }
    parsed.set(path, { path, doc, lines });
  }
  if (errors.length > 0) return { status: "error", errors };

  let raw: RawFiles = {};
  for (const [path, file] of parsed) raw[path] = file.doc.toJS();

  // Schemaversion
  const projectFile = parsed.get(PROJECT_FILE)!;
  const rawProject = raw[PROJECT_FILE];
  const rawVersion =
    rawProject && typeof rawProject === "object"
      ? (rawProject as Record<string, unknown>).schemaVersion
      : undefined;
  let notice: string | undefined;
  if (rawVersion === undefined || typeof rawVersion === "number") {
    const version = rawVersion ?? 0;
    if (version > CURRENT_SCHEMA_VERSION) {
      return {
        status: "error",
        errors: [
          {
            file: PROJECT_FILE,
            line: lineOf(projectFile, ["schemaVersion"]),
            message: `Projekt wurde mit neuerer App-Version erstellt (Schemaversion ${version}, unterstützt bis ${CURRENT_SCHEMA_VERSION})`,
          },
        ],
      };
    }
    if (version < CURRENT_SCHEMA_VERSION) {
      if (!hasMigration(version)) {
        const message =
          rawVersion === undefined
            ? "Schemaverstoß bei schemaVersion: Pflichtfeld fehlt"
            : `Keine Migration von Schemaversion ${version} verfügbar`;
        return {
          status: "error",
          errors: [
            {
              file: PROJECT_FILE,
              line: rawVersion === undefined ? 1 : lineOf(projectFile, ["schemaVersion"]),
              message,
            },
          ],
        };
      }
      raw = migrate(raw, version);
      notice = migrationNotice(CURRENT_SCHEMA_VERSION);
    }
  }

  // Schema je Datei
  const projectResult = ProjectFileSchema.safeParse(raw[PROJECT_FILE]);
  if (!projectResult.success)
    errors.push(...schemaErrors(PROJECT_FILE, projectFile, projectResult.error));
  let catalogFile: CatalogFile | undefined;
  if (raw[CATALOG_FILE] !== undefined) {
    const result = CatalogFileSchema.safeParse(raw[CATALOG_FILE] ?? {});
    if (result.success) catalogFile = result.data;
    else errors.push(...schemaErrors(CATALOG_FILE, parsed.get(CATALOG_FILE), result.error));
  }
  let warningsFile: WarningsFile | undefined;
  if (raw[WARNINGS_FILE] !== undefined) {
    const result = WarningsFileSchema.safeParse(raw[WARNINGS_FILE] ?? {});
    if (result.success) warningsFile = result.data;
    else errors.push(...schemaErrors(WARNINGS_FILE, parsed.get(WARNINGS_FILE), result.error));
  }
  let cablesFile: CablesFile | undefined;
  if (raw[CABLES_FILE] !== undefined) {
    const result = CablesFileSchema.safeParse(raw[CABLES_FILE] ?? {});
    if (result.success) cablesFile = result.data;
    else errors.push(...schemaErrors(CABLES_FILE, parsed.get(CABLES_FILE), result.error));
  }
  const storeyFiles: { path: string; data: StoreyFile }[] = [];
  for (const path of storeyPaths) {
    const result = StoreyFileSchema.safeParse(raw[path]);
    if (result.success) storeyFiles.push({ path, data: result.data });
    else errors.push(...schemaErrors(path, parsed.get(path), result.error));
  }
  if (errors.length > 0) return { status: "error", errors };

  // Konsistenz der Dateien
  const slugOwners = new Map<string, string>();
  const idOwners = new Map<string, { file: string; line?: number }>();
  const checkIds = (path: string, ids: { id: string; path: Segment[] }[]) => {
    const file = parsed.get(path);
    for (const { id, path: idPath } of ids) {
      const line = file ? lineOf(file, idPath) : undefined;
      const other = idOwners.get(id);
      if (other) {
        errors.push({
          file: path,
          line,
          message: `ID „${id}“ ist doppelt (auch in ${other.file}${other.line ? `, Zeile ${other.line}` : ""})`,
        });
      } else {
        idOwners.set(id, { file: path, line });
      }
    }
  };
  if (catalogFile) checkIds(CATALOG_FILE, catalogFileIds(catalogFile));
  for (const { path, data } of storeyFiles) {
    const file = parsed.get(path)!;
    const fileSlug = storeySlugFromPath(path)!;
    if (data.storey.slug !== fileSlug) {
      errors.push({
        file: path,
        line: lineOf(file, ["storey", "slug"]),
        message: `Slug „${data.storey.slug}“ passt nicht zum Dateinamen „${fileSlug}.yaml“`,
      });
    }
    const otherSlug = slugOwners.get(data.storey.slug);
    if (otherSlug) {
      errors.push({
        file: path,
        line: lineOf(file, ["storey", "slug"]),
        message: `Slug „${data.storey.slug}“ ist doppelt (auch in ${otherSlug})`,
      });
    } else {
      slugOwners.set(data.storey.slug, path);
    }
    checkIds(path, storeyFileIds(data));
  }
  if (cablesFile)
    checkIds(
      CABLES_FILE,
      (cablesFile.cables ?? []).map((c, i) => ({ id: c.id, path: ["cables", i, "id"] })),
    );
  if (errors.length > 0) return { status: "error", errors };

  return {
    status: "ok",
    project: filesToProject(
      projectResult.data as ProjectFile,
      storeyFiles.map((s) => s.data),
      catalogFile,
      warningsFile,
      cablesFile,
    ),
    contents,
    ...(notice ? { notice } : {}),
  };
}
