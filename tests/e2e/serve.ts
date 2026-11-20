/** Startet den Dev-Server für Playwright auf einem temporären Projektordner und räumt danach auf. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = mkdtempSync(join(tmpdir(), "hausplaner-e2e-"));
const child = spawn(
  process.execPath,
  [join(repo, "server", "dev.ts"), dir, ...process.argv.slice(2)],
  {
    cwd: repo,
    stdio: "inherit",
    env: { ...process.env, INIT_CWD: repo },
  },
);
const cleanup = () => rmSync(dir, { recursive: true, force: true });
const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
