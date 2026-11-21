import { loadProject } from "../../../src/io/load";
import type { FileResult } from "../../../src/io/api";
import { registerMigration, unregisterMigration } from "../../../src/model/migrations";
import { createProjectStore } from "../../../src/store/history";
import {
  AUTOSAVE_DELAY_MS,
  createSaveController,
  RETRY_INTERVAL_MS,
} from "../../../src/store/save";
import { readFixture, readV1Fixture } from "../fixtures";

function setup(files = readFixture("klein")) {
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error("Fixture lädt nicht");
  const store = createProjectStore(result.project);
  const calls: Record<string, string | null>[] = [];
  const failing = new Set<string>();
  const api = {
    putFiles: vi.fn(async (changes: Record<string, string | null>) => {
      calls.push(changes);
      const results: Record<string, FileResult> = {};
      for (const path of Object.keys(changes))
        results[path] = failing.has(path) ? { error: "schreibgeschützt" } : "ok";
      return results;
    }),
  };
  const save = createSaveController(store, api, result.contents);
  return { store, save, api, calls, failing, result };
}

const renameProject = (name: string) => ({
  label: "Projekt umbenennen",
  run: (d: { name: string }) => void (d.name = name),
});

describe("Speichern (4.2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    unregisterMigration(0);
  });

  test("Autospeichern 2 s nach dem letzten Befehl, nur geänderte Dateien", async () => {
    const { store, save, calls } = setup();
    expect(save.getState().status).toBe("saved");
    store.execute(renameProject("A"));
    expect(save.getState().status).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    store.execute(renameProject("B"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]!)).toEqual(["projekt.yaml"]);
    expect(calls[0]!["projekt.yaml"]).toContain('name: "B"');
    expect(save.getState().status).toBe("saved");
  });

  test("Laden ohne Änderung schreibt nichts, auch nicht mit Cmd/Strg+S", async () => {
    const { save, calls } = setup();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    await save.saveNow();
    expect(calls).toHaveLength(0);
  });

  test("Fehler einer einzelnen Datei, Wiederholversuch nach 10 s gelingt", async () => {
    const { store, save, calls, failing } = setup();
    failing.add("geschosse/eg.yaml");
    store.execute(renameProject("A"));
    store.execute({
      label: "Geschoss umbenennen",
      run: (d) => void (d.storeys[0]!.name = "Erdgeschoss"),
    });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(save.getState().status).toBe("error");
    expect(save.getState().errors).toEqual({ "geschosse/eg.yaml": "schreibgeschützt" });
    failing.clear();
    await vi.advanceTimersByTimeAsync(RETRY_INTERVAL_MS);
    expect(calls).toHaveLength(2);
    expect(Object.keys(calls[1]!)).toEqual(["geschosse/eg.yaml"]); // projekt.yaml war schon gespeichert
    expect(save.getState().status).toBe("saved");
  });

  test("nicht kanonische Datei wird beim nächsten Speichern kanonisch geschrieben", async () => {
    const files = readFixture("klein");
    const canonical = files["geschosse/eg.yaml"]!;
    files["geschosse/eg.yaml"] = canonical.replace("walls:\n", "walls:  \n"); // von Hand verändert
    const { store, calls } = setup(files);
    store.execute(renameProject("A"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[0]!["geschosse/eg.yaml"]).toBe(canonical);
  });

  test("gelöschtes Geschoss: Datei wird mit null gelöscht", async () => {
    const { store, calls } = setup();
    store.execute({
      label: "Geschoss löschen",
      run: (d) => {
        d.storeys = [];
        d.walls = [];
        d.rooms = [];
        d.openings = [];
      },
    });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls[0]).toEqual({ "geschosse/eg.yaml": null });
  });

  test("nach Migration schreibt erst die erste Änderung projekt.yaml mit schemaVersion 2 und katalog.yaml", async () => {
    registerMigration(0, (f) => ({
      ...f,
      "projekt.yaml": { schemaVersion: 1, ...(f["projekt.yaml"] as object) },
    }));
    const files = readV1Fixture("klein");
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 1\n", "");
    const { store, calls } = setup(files);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(calls).toHaveLength(0);
    store.execute({
      label: "Geschoss umbenennen",
      run: (d) => void (d.storeys[0]!.name = "Erdgeschoss"),
    });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(Object.keys(calls[0]!).sort()).toEqual([
      "geschosse/eg.yaml",
      "katalog.yaml",
      "projekt.yaml",
    ]);
    expect(calls[0]!["projekt.yaml"]).toMatch(/^schemaVersion: 2\n/);
  });

  test("Cmd/Strg+S nach Migration schreibt auch ohne Änderung", async () => {
    registerMigration(0, (f) => ({
      ...f,
      "projekt.yaml": { schemaVersion: 1, ...(f["projekt.yaml"] as object) },
    }));
    const files = readV1Fixture("klein");
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 1\n", "");
    const { save, calls } = setup(files);
    await save.saveNow();
    expect(Object.keys(calls[0]!).sort()).toEqual(["katalog.yaml", "projekt.yaml"]);
  });

  test("externe Änderung pausiert; Cmd/Strg+S schreibt erst nach Bestätigung, danach läuft Autospeichern wieder", async () => {
    const { store, save, calls } = setup();
    save.externalChange(["geschosse/eg.yaml"]);
    store.execute(renameProject("A"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(calls).toHaveLength(0);
    await save.saveNow();
    expect(calls).toHaveLength(0);
    await save.saveNow({ overwrite: true });
    expect(calls).toHaveLength(1);
    expect(save.getState().externalChanges).toEqual([]);
    store.execute(renameProject("B"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(2);
  });
});
