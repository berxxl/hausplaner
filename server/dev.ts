/** npm run dev -- <ordner> [vite-optionen]: zuerst der API-Server, dann Vite mit Proxy auf dessen Port. */
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, listen } from "./app.ts";
import { projectDirFromArgs } from "./cli.ts";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const { projectDir, rest } = projectDirFromArgs(process.argv.slice(2));
const app = createApp({ projectDir });
const port = await listen(app.server);
console.log(`API-Server auf 127.0.0.1:${port}, Projektordner: ${projectDir}`);

const vite = spawn(
  process.execPath,
  [join(repo, "node_modules", "vite", "bin", "vite.js"), ...rest],
  {
    cwd: repo,
    stdio: "inherit",
    env: { ...process.env, HAUSPLANER_API_PORT: String(port) },
  },
);
const stop = () => {
  vite.kill();
  void app.close().then(() => process.exit(0));
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", (code) => void app.close().then(() => process.exit(code ?? 0)));
