import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { APIRequestContext, Page } from "@playwright/test";
import { parse } from "yaml";
import type { StoreyFile } from "../../src/model/schema";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
export const PDF = {
  vector: join(FIXTURES, "pdf", "vektorplan.pdf"),
  scan: join(FIXTURES, "pdf", "scan.pdf"),
};

function fixtureFiles(name: string): Record<string, string> {
  const dir = join(FIXTURES, name);
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".yaml"))
        files[relative(dir, p).split(sep).join("/")] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return files;
}

/** Setzt den Projektordner auf ein Fixture zurück (alle anderen YAML-Dateien werden gelöscht). */
export async function resetProject(request: APIRequestContext, name: string): Promise<void> {
  const current = (await (await request.get("/api/project")).json()) as {
    files?: Record<string, string>;
  };
  const target = fixtureFiles(name);
  const files: Record<string, string | null> = { ...target };
  for (const path of Object.keys(current.files ?? {})) if (!(path in target)) files[path] = null;
  const res = await request.put("/api/files", { data: { files } });
  if (!res.ok()) throw new Error(`Zurücksetzen fehlgeschlagen: ${res.status()}`);
}

export async function projectFiles(request: APIRequestContext): Promise<Record<string, string>> {
  return ((await (await request.get("/api/project")).json()) as { files: Record<string, string> })
    .files;
}

export async function storeyFile(request: APIRequestContext, slug: string): Promise<StoreyFile> {
  return parse((await projectFiles(request))[`geschosse/${slug}.yaml`]!) as StoreyFile;
}

export async function openProject(
  page: Page,
  request: APIRequestContext,
  fixture = "klein",
): Promise<void> {
  await resetProject(request, fixture);
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();
}

/** Speichert sofort (Cmd/Strg+S) und wartet auf „gespeichert“. */
export async function saveNow(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+s");
  await page
    .getByRole("status", { name: "Speicherstand" })
    .filter({ hasText: /^gespeichert$/ })
    .waitFor();
}

/** Bildschirmposition (Seite) eines Weltpunkts im Grundriss. */
export async function worldToPage(
  page: Page,
  world: { x: number; y: number },
): Promise<{ x: number; y: number }> {
  const svg = page.getByRole("img", { name: "Grundriss" });
  const box = (await svg.boundingBox())!;
  const [cx, cy, zoom] = await Promise.all(
    ["data-cx", "data-cy", "data-zoom"].map(async (a) => Number(await svg.getAttribute(a))),
  );
  return {
    x: box.x + box.width / 2 + (world.x - cx!) * zoom!,
    y: box.y + box.height / 2 - (world.y - cy!) * zoom!,
  };
}

/** Leert den Projektordner (alle YAML-Dateien löschen); Pläne bleiben liegen. */
export async function clearProject(request: APIRequestContext): Promise<void> {
  const current = (await (await request.get("/api/project")).json()) as {
    files?: Record<string, string>;
  };
  const files: Record<string, null> = {};
  for (const path of Object.keys(current.files ?? {})) files[path] = null;
  if (Object.keys(files).length > 0) await request.put("/api/files", { data: { files } });
}

/** Fixture-Dateien mehrerer Projekte zusammenführen und schreiben. */
export async function writeFiles(
  request: APIRequestContext,
  files: Record<string, string>,
): Promise<void> {
  const res = await request.put("/api/files", { data: { files } });
  if (!res.ok()) throw new Error(`Schreiben fehlgeschlagen: ${res.status()}`);
}

export { fixtureFiles };
