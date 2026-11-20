// @vitest-environment node
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:net";
import { join } from "node:path";

const repo = join(__dirname, "..", "..", "..");

test("npm run dev: bei belegtem Port 5180 erreicht der Vite-Proxy den API-Server auf dem Ausweichport (3.5)", async () => {
  const blocker: Server = createServer();
  await new Promise<void>((resolve) => {
    blocker.once("error", () => resolve()); // schon belegt: auch gut
    blocker.listen(5180, "127.0.0.1", () => resolve());
  });
  const vitePort = 15900 + Math.floor(Math.random() * 90);
  const child = spawn(
    process.execPath,
    [
      join(repo, "server", "dev.ts"),
      join(repo, "tests", "fixtures", "klein"),
      "--port",
      String(vitePort),
      "--strictPort",
    ],
    { cwd: repo, env: { ...process.env, INIT_CWD: repo }, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  try {
    let body: { status?: string; files?: Record<string, string> } | undefined;
    for (let i = 0; i < 100 && !body; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${vitePort}/api/project`);
        if (res.ok) body = await res.json();
      } catch {
        // Vite startet noch
      }
    }
    expect(body?.status, output).toBe("ok");
    expect(Object.keys(body?.files ?? {}).sort()).toEqual(["geschosse/eg.yaml", "projekt.yaml"]);
    const apiPort = Number(/API-Server auf 127\.0\.0\.1:(\d+)/.exec(output)?.[1]);
    expect(apiPort).toBeGreaterThan(5180);
    expect(apiPort).toBeLessThanOrEqual(5189);
  } finally {
    child.kill("SIGTERM");
    blocker.close();
  }
}, 30000);
