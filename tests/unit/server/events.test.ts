// @vitest-environment node
import { request } from "node:http";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { putFiles, startApp, tempDir, type Running } from "./helpers";

/** Sammelt SSE-Ereignisse `changed` für eine Zeitspanne. */
function collect(port: number, ms: number, action: () => Promise<void>): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const events: string[][] = [];
    const req = request({ host: "127.0.0.1", port, path: "/api/events" }, (res) => {
      let buffer = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        let i: number;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (/^event: changed$/m.test(block) && data) events.push(JSON.parse(data).paths);
        }
      });
      // verspätete Meldungen aus dem Testaufbau (FSEvents) abwarten und verwerfen
      void wait(600)
        .then(() => {
          events.length = 0;
          return action();
        })
        .then(() =>
          setTimeout(() => {
            req.destroy();
            resolve(events);
          }, ms),
        );
    });
    req.on("error", (e) => (e.message.includes("socket hang up") ? undefined : reject(e)));
    req.end();
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Dateibeobachtung (3.4)", () => {
  let s: Running;
  afterEach(async () => s?.app.close());

  test("externe Änderung, neue und gelöschte Datei werden gemeldet, entprellt", async () => {
    const root = await tempDir();
    await mkdir(join(root, "geschosse"));
    await writeFile(join(root, "projekt.yaml"), "a: 1\n");
    await writeFile(join(root, "geschosse", "eg.yaml"), "b: 1\n");
    s = await startApp(root);
    const events = await collect(s.port, 1500, async () => {
      await writeFile(join(root, "projekt.yaml"), "a: 2\n");
      await writeFile(join(root, "geschosse", "og.yaml"), "c: 1\n");
      await rm(join(root, "geschosse", "eg.yaml"));
    });
    expect(events).toEqual([["geschosse/eg.yaml", "geschosse/og.yaml", "projekt.yaml"]]);
    // Start des Watchers dauert auf Windows-Runnern bis zu 4 s
  }, 15000);

  test("eigene Schreibvorgänge und Dateien in plaene/ werden nicht gemeldet", async () => {
    const root = await tempDir();
    await writeFile(join(root, "projekt.yaml"), "a: 1\n");
    s = await startApp(root);
    const events = await collect(s.port, 1500, async () => {
      await putFiles(s.port, { "projekt.yaml": "a: 2\n", "geschosse/eg.yaml": "b: 1\n" });
      await putFiles(s.port, { "geschosse/eg.yaml": null });
      await mkdir(join(root, "plaene"), { recursive: true });
      await writeFile(join(root, "plaene", "eg.pdf"), "%PDF");
      await writeFile(join(root, "plaene", "notiz.yaml"), "x: 1\n");
    });
    expect(events).toEqual([]);
  });
});
