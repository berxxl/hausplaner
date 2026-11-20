/** Dateizugriff im Projektordner: Lesen aller *.yaml, atomares Schreiben, Löschen, PDF-Ablage. */
import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
  realpath,
} from "node:fs/promises";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { HttpError, resolveInProject } from "./paths.ts";

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export type ProjectListing =
  | { status: "ok"; folder: string; files: Record<string, string> }
  | { status: "empty"; folder: string }
  | { status: "missing"; folder: string };

/** Alle *.yaml im Projektordner (rekursiv, ohne .git/), nur innerhalb des Projektordners. */
export async function readProject(root: string): Promise<ProjectListing> {
  const folder = basename(root);
  if (!(await exists(root))) return { status: "missing", folder };
  const realRoot = await realpath(root);
  const files: Record<string, string> = {};
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const abs = join(dir, entry.name);
      let real: string;
      try {
        real = await realpath(abs);
      } catch {
        continue;
      }
      const rel = relative(realRoot, real);
      if (rel.startsWith("..")) continue; // Symlink nach außen
      const info = await stat(real);
      if (info.isDirectory()) await walk(abs);
      else if (entry.name.endsWith(".yaml")) {
        files[relative(root, abs).split(sep).join("/")] = await readFile(real, "utf8");
      }
    }
  };
  await walk(root);
  return Object.keys(files).length === 0
    ? { status: "empty", folder }
    : { status: "ok", folder, files };
}

/** Schreibt über eine temporäre Datei im selben Ordner und rename (je Datei atomar). */
export async function writeAtomic(abs: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(abs), { recursive: true });
  const tmp = join(dirname(abs), `.${basename(abs)}.tmp-${randomBytes(4).toString("hex")}`);
  try {
    await writeFile(tmp, data);
    await rename(tmp, abs);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

export type FileResult = "ok" | { error: string };

/** Hält fest, was der Server selbst geschrieben oder gelöscht hat (für die Dateibeobachtung). */
export interface OwnWrites {
  written(rel: string, hash: string): void;
  deleted(rel: string): void;
}

/**
 * PUT /api/files: prüft zuerst alle Pfade (400/403 bricht den ganzen Stapel ab),
 * schreibt dann jede Datei für sich; `null` = löschen, fehlende Datei = "ok".
 */
export async function writeFiles(
  root: string,
  files: Record<string, string | null>,
  own: OwnWrites,
): Promise<Record<string, FileResult>> {
  await mkdir(root, { recursive: true });
  const resolved: { rel: string; abs: string; content: string | null }[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (content !== null && typeof content !== "string") {
      throw new HttpError(400, "invalid-body", `Inhalt für ${path} muss Text oder null sein`);
    }
    resolved.push({ ...(await resolveInProject(root, path)), content });
  }
  const results: Record<string, FileResult> = {};
  for (const { rel, abs, content } of resolved) {
    try {
      if (content === null) {
        own.deleted(rel);
        await unlink(abs).catch((e: NodeJS.ErrnoException) => {
          if (e.code !== "ENOENT") throw e;
        });
      } else {
        own.written(rel, sha256(content));
        await writeAtomic(abs, content);
      }
      results[rel] = "ok";
    } catch (e) {
      results[rel] = { error: (e as Error).message };
    }
  }
  return results;
}

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".yaml": "text/yaml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".mjs": "text/javascript; charset=utf-8",
};

export function contentType(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

/**
 * PUT /api/raw/plaene/<name>: liegt eine Datei gleichen Inhalts in plaene/, wird deren Pfad
 * geliefert (200); sonst wird mit Kollisionssuffix geschrieben (201).
 */
export async function storePlan(
  root: string,
  name: string,
  data: Uint8Array,
): Promise<{ status: 200 | 201; path: string }> {
  const { abs: dirAbs } = await resolveInProject(root, "plaene");
  const hash = sha256(data);
  if (await exists(dirAbs)) {
    for (const entry of (await readdir(dirAbs, { withFileTypes: true })).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      if (!entry.isFile() || entry.name.startsWith(".")) continue;
      if (sha256(await readFile(join(dirAbs, entry.name))) === hash) {
        return { status: 200, path: `plaene/${entry.name}` };
      }
    }
  }
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? name : `${stem}-${i}${ext}`;
    const { rel, abs } = await resolveInProject(root, `plaene/${candidate}`);
    if (await exists(abs)) continue;
    await writeAtomic(abs, data);
    return { status: 201, path: rel };
  }
}
