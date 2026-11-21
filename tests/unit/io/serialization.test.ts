import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { writeYaml } from "../../../src/io/writer";
import type { Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

function load(files: Record<string, string>): Project {
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error(JSON.stringify(result));
  return result.project;
}

describe("Schema (2.1)", () => {
  test.each(["klein", "dg"])("Fixture %s besteht die Prüfung", (name) => {
    expect(loadProject(readFixture(name)).status).toBe("ok");
  });
});

describe("Aufteilen und Zusammenführen (2.2)", () => {
  test("storeyId wird beim Laden gesetzt", () => {
    const p = load(readFixture("klein"));
    const storeyId = p.storeys[0]!.id;
    expect(p.walls).toHaveLength(7);
    expect(p.rooms).toHaveLength(4);
    expect([...p.walls, ...p.rooms, ...p.openings].every((x) => x.storeyId === storeyId)).toBe(
      true,
    );
  });

  test("unbekannte verteiler.yaml wird ignoriert und nie geschrieben", () => {
    const files = { ...readFixture("klein"), "verteiler.yaml": "boards: []\nunbekannt: 1\n" };
    const out = projectToFiles(load(files));
    expect(Object.keys(out).sort()).toEqual(["geschosse/eg.yaml", "projekt.yaml"]);
  });

  test("fehlende Geschossdateien: Projekt ohne Geschosse", () => {
    const p = load({ "projekt.yaml": readFixture("klein")["projekt.yaml"]! });
    expect(p.storeys).toEqual([]);
  });
});

describe("Golden Files (2.3)", () => {
  test.each(["klein", "dg"])("(a) %s: Laden → Speichern byteweise identisch", (name) => {
    const files = readFixture(name);
    expect(projectToFiles(load(files))).toEqual(files);
  });

  test("(b) Öffnung verschieben ändert genau eine Zeile", () => {
    const files = readFixture("dg");
    const p = load(files);
    p.openings[0]!.offsetMm += 200;
    const before = files["geschosse/dg.yaml"]!.split("\n");
    const after = projectToFiles(p)["geschosse/dg.yaml"]!.split("\n");
    expect(after).toHaveLength(before.length);
    const changed = after.filter((line, i) => line !== before[i]);
    expect(changed).toEqual(["    offsetMm: 1695"]);
  });

  test("(c) Reihenfolge der Bearbeitung ändert die Datei nicht", () => {
    const p = load(readFixture("klein"));
    const reversed: Project = {
      ...p,
      walls: [...p.walls].reverse(),
      rooms: [...p.rooms].reverse(),
    };
    expect(projectToFiles(reversed)).toEqual(projectToFiles(p));
  });

  test("(d) Zahlen: ganz ohne .0, kürzeste Dezimaldarstellung, -0 → 0", () => {
    const yaml = writeYaml({ x: 512.0, y: -0 }, "point");
    expect(yaml).toBe("{x: 512, y: 0}\n");
    expect(writeYaml({ x: 102.4, y: -3 }, "point")).toBe("{x: 102.4, y: -3}\n");
  });

  test("leere optionale Listen werden weggelassen", () => {
    const p = load(readFixture("dg"));
    p.rooms = [];
    p.openings = [];
    const out = projectToFiles(p)["geschosse/dg.yaml"]!;
    expect(out).not.toContain("rooms:");
    expect(out).not.toContain("openings:");
  });
});
