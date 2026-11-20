/** npm start -- <ordner>: baut die App bei Bedarf und startet den Server mit dist/. */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, listen, HOST } from "./app.ts";
import { openBrowser, projectDirFromArgs } from "./cli.ts";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(repo, "dist");

function newestMtime(path: string): number {
  const info = statSync(path);
  if (!info.isDirectory()) return info.mtimeMs;
  let newest = info.mtimeMs;
  for (const entry of readdirSync(path)) newest = Math.max(newest, newestMtime(join(path, entry)));
  return newest;
}

/** Build nötig, wenn dist/ fehlt oder älter ist als die neueste Quelldatei. */
export function needsBuild(): boolean {
  const index = join(dist, "index.html");
  if (!existsSync(index)) return true;
  const sources = ["src", "index.html", "package.json", "vite.config.ts"]
    .map((p) => join(repo, p))
    .filter(existsSync);
  return Math.max(...sources.map(newestMtime)) > statSync(index).mtimeMs;
}

const { projectDir } = projectDirFromArgs(process.argv.slice(2));
if (needsBuild()) {
  console.log("Baue die App …");
  const vite = join(repo, "node_modules", "vite", "bin", "vite.js");
  const result = spawnSync(process.execPath, [vite, "build"], { cwd: repo, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const app = createApp({ projectDir, staticDir: dist });
const port = await listen(app.server);
const url = `http://${HOST}:${port}`;
console.log(`Hausplaner läuft auf ${url}\nProjektordner: ${projectDir}`);
openBrowser(url);
