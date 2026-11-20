// @vitest-environment node
import { createServer, type Server } from "node:net";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createApp, FIRST_PORT, LAST_PORT, listen } from "../../../server/app.ts";
import { call, putFiles, startApp, tempDir, type Running } from "./helpers";

describe("Bindung und Port (3.1)", () => {
  test("Standardbereich 5180–5189", () => {
    expect([FIRST_PORT, LAST_PORT]).toEqual([5180, 5189]);
  });

  test("bindet nur an 127.0.0.1 und weicht bei belegtem Port aus", async () => {
    const blocker: Server = createServer();
    const first = 16100 + Math.floor(Math.random() * 500);
    await new Promise<void>((r) => blocker.listen(first, "127.0.0.1", () => r()));
    const app = createApp({ projectDir: await tempDir() });
    try {
      const port = await listen(app.server, first, first + 3);
      expect(port).toBe(first + 1);
      const address = app.server.address();
      expect(typeof address === "object" && address?.address).toBe("127.0.0.1");
    } finally {
      await app.close();
      blocker.close();
    }
  });

  test("Abbruch, wenn kein Port frei ist", async () => {
    const blocker: Server = createServer();
    const first = 16700 + Math.floor(Math.random() * 500);
    await new Promise<void>((r) => blocker.listen(first, "127.0.0.1", () => r()));
    const app = createApp({ projectDir: await tempDir() });
    try {
      await expect(listen(app.server, first, first)).rejects.toThrow(/Kein freier Port/);
    } finally {
      await app.close();
      blocker.close();
    }
  });
});

describe("Endpunkte (3.2)", () => {
  let s: Running;
  afterEach(async () => s?.app.close());

  test("GET /api/project: missing, empty, ok (rekursiv, ohne .git/)", async () => {
    const root = join(await tempDir(), "daten");
    s = await startApp(root);
    expect((await call(s.port, "GET", "/api/project")).json()).toEqual({
      status: "missing",
      folder: "daten",
    });
    await mkdir(join(root, ".git"), { recursive: true });
    await writeFile(join(root, "README.md"), "x");
    await writeFile(join(root, ".git", "x.yaml"), "a: 1\n");
    expect((await call(s.port, "GET", "/api/project")).json()).toEqual({
      status: "empty",
      folder: "daten",
    });
    await mkdir(join(root, "geschosse"));
    await writeFile(join(root, "projekt.yaml"), "a: 1\n");
    await writeFile(join(root, "geschosse", "eg.yaml"), "b: 2\n");
    expect((await call(s.port, "GET", "/api/project")).json()).toEqual({
      status: "ok",
      folder: "daten",
      files: { "projekt.yaml": "a: 1\n", "geschosse/eg.yaml": "b: 2\n" },
    });
  });

  test("PUT /api/files: schreibt, legt Ordner an, löscht mit null, null auf fehlende Datei = ok", async () => {
    const root = join(await tempDir(), "neu");
    s = await startApp(root);
    const r1 = await putFiles(s.port, { "projekt.yaml": "a: 1\n", "geschosse/eg.yaml": "b: 2\n" });
    expect(r1.status).toBe(200);
    expect(r1.json()).toEqual({ results: { "projekt.yaml": "ok", "geschosse/eg.yaml": "ok" } });
    expect(await readFile(join(root, "geschosse", "eg.yaml"), "utf8")).toBe("b: 2\n");
    const r2 = await putFiles(s.port, { "geschosse/eg.yaml": null, "geschosse/fehlt.yaml": null });
    expect(r2.json()).toEqual({
      results: { "geschosse/eg.yaml": "ok", "geschosse/fehlt.yaml": "ok" },
    });
    expect(existsSync(join(root, "geschosse", "eg.yaml"))).toBe(false);
  });

  test("PUT /api/files: Fehler einer einzelnen Datei wird je Datei gemeldet", async () => {
    const root = await tempDir();
    s = await startApp(root);
    await mkdir(join(root, "ordner.yaml")); // ein Ordner, wo eine Datei hin soll
    const r = await putFiles(s.port, { "a.yaml": "x: 1\n", "ordner.yaml": "y: 2\n" });
    expect(r.status).toBe(200);
    const { results } = r.json<{ results: Record<string, unknown> }>();
    expect(results["a.yaml"]).toBe("ok");
    expect(results["ordner.yaml"]).toMatchObject({ error: expect.any(String) });
  });

  test("PUT /api/files: ungültiger Pfad → 400, nichts aus dem Stapel geschrieben", async () => {
    const root = await tempDir();
    s = await startApp(root);
    const r = await putFiles(s.port, { "gut.yaml": "a: 1\n", "../boese.yaml": "b: 2\n" });
    expect(r.status).toBe(400);
    expect(r.json()).toMatchObject({ error: { code: "invalid-path" } });
    expect(existsSync(join(root, "gut.yaml"))).toBe(false);
  });

  test("GET /api/raw: 200 mit Content-Type, 404", async () => {
    const root = await tempDir();
    s = await startApp(root);
    await mkdir(join(root, "plaene"));
    await writeFile(join(root, "plaene", "eg.pdf"), "%PDF-1.4");
    const ok = await call(s.port, "GET", "/api/raw/plaene/eg.pdf");
    expect(ok.status).toBe(200);
    expect(ok.body.toString()).toBe("%PDF-1.4");
    expect((await call(s.port, "GET", "/api/raw/plaene/fehlt.pdf")).status).toBe(404);
  });

  test("PUT /api/raw/plaene: 201 neu, 200 bei gleichem Inhalt, Kollisionssuffix, 400 außerhalb von plaene/", async () => {
    const root = await tempDir();
    s = await startApp(root);
    const a = await call(s.port, "PUT", "/api/raw/plaene/eg.pdf", Buffer.from("A"));
    expect([a.status, a.json()]).toEqual([201, { path: "plaene/eg.pdf" }]);
    const same = await call(s.port, "PUT", "/api/raw/plaene/anders.pdf", Buffer.from("A"));
    expect([same.status, same.json()]).toEqual([200, { path: "plaene/eg.pdf" }]);
    const b = await call(s.port, "PUT", "/api/raw/plaene/eg.pdf", Buffer.from("B"));
    expect([b.status, b.json()]).toEqual([201, { path: "plaene/eg-2.pdf" }]);
    expect(await readFile(join(root, "plaene", "eg-2.pdf"), "utf8")).toBe("B");
    expect((await call(s.port, "PUT", "/api/raw/geschosse/x.pdf", Buffer.from("C"))).status).toBe(
      400,
    );
    expect((await call(s.port, "PUT", "/api/raw/plaene/a/b.pdf", Buffer.from("C"))).status).toBe(
      400,
    );
  });
});

describe("Pfadprüfung (3.3)", () => {
  let s: Running;
  let outside: string;
  beforeEach(async () => {
    outside = await tempDir();
    await writeFile(join(outside, "geheim.yaml"), "geheim: 1\n");
  });
  afterEach(async () => {
    await s?.app.close();
    await rm(outside, { recursive: true, force: true });
  });

  test.each([
    ["..", "/api/raw/../geheim.yaml"],
    ["%2e%2e", "/api/raw/%2e%2e/geheim.yaml"],
    ["absolut", "/api/raw//etc/passwd"],
    ["C:\\", "/api/raw/C:%5Cwindows"],
    ["Laufwerk", "/api/raw/C:/windows"],
    ["Backslash", "/api/raw/plaene%5C..%5Cx"],
  ])("GET %s → 400", async (_name, path) => {
    s = await startApp(await tempDir());
    const r = await call(s.port, "GET", path);
    expect(r.status).toBe(400);
  });

  test.each(["../x.yaml", "%2e%2e/x.yaml", "/abs.yaml", "C:\\x.yaml", "a\\b.yaml", "a//b.yaml"])(
    "PUT /api/files mit %s → 400",
    async (bad) => {
      s = await startApp(await tempDir());
      expect((await putFiles(s.port, { [bad]: "x: 1\n" })).status).toBe(400);
    },
  );

  test("Symlink auf eine Datei außerhalb → 403", async () => {
    const root = await tempDir();
    await symlink(join(outside, "geheim.yaml"), join(root, "link.yaml"));
    s = await startApp(root);
    const r = await call(s.port, "GET", "/api/raw/link.yaml");
    expect(r.status).toBe(403);
    expect(r.json()).toMatchObject({ error: { code: "outside-project" } });
    // Auch die Projektliste liest ihn nicht.
    expect((await call(s.port, "GET", "/api/project")).json()).toMatchObject({ status: "empty" });
  });

  test("Symlink-Ordner nach außen mit neuer Datei → 403, nichts aus dem Stapel geschrieben", async () => {
    const root = await tempDir();
    await symlink(outside, join(root, "geschosse"), "dir");
    s = await startApp(root);
    const r = await putFiles(s.port, { "projekt.yaml": "a: 1\n", "geschosse/neu.yaml": "b: 2\n" });
    expect(r.status).toBe(403);
    expect(existsSync(join(outside, "neu.yaml"))).toBe(false);
    expect(existsSync(join(root, "projekt.yaml"))).toBe(false);
  });
});
