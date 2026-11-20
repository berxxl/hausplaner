import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { registerMigration, unregisterMigration } from "../../../src/model/migrations";
import { readFixture } from "../fixtures";

describe("Schemaversion und Migration (2.6)", () => {
  afterEach(() => unregisterMigration(0));

  function withoutVersion() {
    const files = readFixture("klein");
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 1\n", "");
    return files;
  }

  test("Dummy-Migration 0 → 1 läuft, liefert Hinweis und schreibt nichts", () => {
    registerMigration(0, (files) => ({
      ...files,
      "projekt.yaml": { schemaVersion: 1, ...(files["projekt.yaml"] as object) },
    }));
    const files = withoutVersion();
    const result = loadProject(files);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.project.schemaVersion).toBe(1);
    expect(result.notice).toBe(
      "Projekt auf Version 1 aktualisiert, wird beim nächsten Speichern geschrieben",
    );
    // Der gelesene Inhalt bleibt die Vergleichsbasis: Laden selbst schreibt nichts.
    expect(result.contents["projekt.yaml"]).toBe(files["projekt.yaml"]);
    // Erst beim Speichern weicht projekt.yaml ab und enthält schemaVersion 1.
    expect(projectToFiles(result.project)["projekt.yaml"]).toMatch(/^schemaVersion: 1\n/);
  });

  test("ohne registrierte Migration ist eine Datei ohne schemaVersion ein Ladefehler", () => {
    expect(loadProject(withoutVersion()).status).toBe("error");
  });
});
