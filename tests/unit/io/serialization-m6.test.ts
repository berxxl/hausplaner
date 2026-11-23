// Dateiformat M5 / Schemaversion 5 (Tasks 1.1, 1.2): Migration 4 → 5, Klimarolle, ansichten.yaml
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { refrigerantUnit } from "../../../src/model/devices";
import { newProject } from "../../../src/model/factory";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { readFixture, readV4Fixture } from "../fixtures";
import { buildM6, M6_IDS } from "./fixture-m6.gen.test";

function load(files: Record<string, string>): Project {
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error(JSON.stringify(result));
  return result.project;
}

const typeOf = (p: Project, id: string) => p.catalog.deviceTypes.find((t) => t.id === id);

describe("Migration 4 → 5 (1.1)", () => {
  test("M4-Projekt: Mindestgefälle 1 %, neue Typen; geschrieben erst mit dem ersten Befehl, nur projekt.yaml und katalog.yaml", () => {
    const files = readV4Fixture("m4");
    const result = loadProject(files);
    if (result.status !== "ok") throw new Error(JSON.stringify(result));
    expect(result.notice).toBe(
      "Projekt auf Version 5 aktualisiert, wird beim nächsten Speichern geschrieben",
    );
    expect(result.contents).toEqual(files);
    expect(result.project.settings.condensateMinSlopePercent).toBe(1);
    const store = createProjectStore(result.project);
    store.execute({ label: "Projekt umbenennen", run: (d) => void (d.name = "Neu") });
    const out = projectToFiles(store.getState().project);
    expect(out["projekt.yaml"]).toMatch(/^schemaVersion: 5\n/);
    expect(out["projekt.yaml"]).toContain("  condensateMinSlopePercent: 1\n");
    expect(out["katalog.yaml"]).toContain('  - id: "condensate-drain"\n');
    expect(out["katalog.yaml"]).toContain('  - id: "ac-outdoor-multi-3"\n');
    for (const path of Object.keys(files).filter(
      (x) => !["projekt.yaml", "katalog.yaml"].includes(x),
    ))
      expect(out[path]).toBe(files[path]);
    expect(out["ansichten.yaml"]).toBeUndefined();
    // die Migration hängt nur an: alle Zeilen der alten katalog.yaml bleiben in derselben Reihenfolge
    const before = files["katalog.yaml"]!.split("\n");
    const after = out["katalog.yaml"]!.split("\n");
    let i = 0;
    for (const line of after) if (line === before[i]) i++;
    expect(i).toBe(before.length);
  });

  test("Klimageräte ohne Rolle bleiben unverändert und werden abgeleitet (Spec-Scenario „Projekt aus M5“)", () => {
    const files = readV4Fixture("m4");
    expect(files["katalog.yaml"]).not.toContain("unit:");
    const p = load(files);
    const indoor = typeOf(p, "ac-indoor")!;
    const outdoor = typeOf(p, "ac-outdoor")!;
    expect(indoor.refrigerant).toEqual({ minLengthM: 3, maxLengthM: 25, prechargedLengthM: 7 });
    expect(outdoor.refrigerant).toEqual({ minLengthM: 3, maxLengthM: 25, prechargedLengthM: 7 });
    expect(refrigerantUnit(indoor)).toBe("indoor");
    expect(refrigerantUnit(outdoor)).toBe("outdoor");
    expect(typeOf(p, "condensate-drain")).toBeDefined();
    expect(refrigerantUnit(typeOf(p, "ac-outdoor-multi-3"))).toBe("outdoor");
  });

  test("Rolle: Feld vor Ableitung, ohne Kältemittelangaben keine Rolle", () => {
    const p = newProject("Neu");
    const indoor = typeOf(p, "ac-indoor")!;
    expect(indoor.refrigerant?.unit).toBe("indoor");
    expect(
      refrigerantUnit({ ...indoor, refrigerant: { ...indoor.refrigerant!, unit: "outdoor" } }),
    ).toBe("outdoor");
    expect(refrigerantUnit(typeOf(p, "spot"))).toBeNull();
    expect(refrigerantUnit(undefined)).toBeNull();
  });

  test("Standardkatalog mit Klimageräten und Kondensatablauf; neues Projekt in Version 5 (Spec-Scenario „Standardkatalog“)", () => {
    const p = newProject("Neu");
    expect(p.schemaVersion).toBe(5);
    expect(p.settings.condensateMinSlopePercent).toBe(1);
    const names = p.catalog.deviceTypes.map((t) => t.name);
    for (const n of [
      "Klima-Innengerät",
      "Klima-Außengerät",
      "Klima-Außengerät Multisplit 3",
      "Kondensatablauf",
    ])
      expect(names).toContain(n);
    const lines = p.catalog.lineTypes.map((t) => t.name);
    expect(lines).toContain("Kondensatleitung");
    expect(lines.some((n) => n.startsWith("Kältemittelleitungspaar"))).toBe(true);
    expect(typeOf(p, "condensate-drain")).toMatchObject({
      trade: "condensate",
      mounting: ["wall", "floor", "free"],
      connects: ["condensate"],
    });
  });
});

describe("ansichten.yaml (1.2)", () => {
  const view = {
    id: "v1kueche",
    name: "Küche vom Esstisch",
    position: { x: 2500, y: 1200, z: 1600 },
    target: { x: 1000, y: 4000, z: 1000 },
    upToStoreyId: "e0g1k2m3",
  };

  test("nur mit Inhalt geschrieben, nach id sortiert, Punkte im Flow-Stil; Rundreise", () => {
    const p = load(readFixture("m4"));
    expect(projectToFiles(p)["ansichten.yaml"]).toBeUndefined();
    const second = {
      id: "a0zweite",
      name: "Zweite",
      position: { x: 0, y: 0, z: 0 },
      target: { x: 1, y: 2, z: 3 },
    };
    const out = projectToFiles({ ...p, cameraViews: [view, second] });
    expect(out["ansichten.yaml"]).toBe(
      [
        "cameraViews:",
        '  - id: "a0zweite"',
        '    name: "Zweite"',
        "    position: {x: 0, y: 0, z: 0}",
        "    target: {x: 1, y: 2, z: 3}",
        '  - id: "v1kueche"',
        '    name: "Küche vom Esstisch"',
        "    position: {x: 2500, y: 1200, z: 1600}",
        "    target: {x: 1000, y: 4000, z: 1000}",
        '    upToStoreyId: "e0g1k2m3"',
        "",
      ].join("\n"),
    );
    const again = load(out);
    expect(again.cameraViews).toEqual([second, view]);
    expect(projectToFiles(again)).toEqual(out);
  });

  test("Ladefehler bei Kommazahl und unbekanntem Feld; unbekanntes Geschoss entfernt der nächste Befehl", () => {
    const p = load(readFixture("m4"));
    const out = projectToFiles({ ...p, cameraViews: [view] });
    const bad = {
      ...out,
      "ansichten.yaml": out["ansichten.yaml"]!.replace("x: 2500", "x: 2500.5"),
    };
    const r = loadProject(bad);
    expect(r.status).toBe("error");
    const extra = { ...out, "ansichten.yaml": out["ansichten.yaml"]! + "    farbe: rot\n" };
    const r2 = loadProject(extra);
    expect(r2.status === "error" && r2.errors[0]!.file).toBe("ansichten.yaml");
    const unknown = load({
      ...out,
      "ansichten.yaml": out["ansichten.yaml"]!.replace("e0g1k2m3", "zzzzzzzz"),
    });
    expect(unknown.cameraViews[0]!.upToStoreyId).toBe("zzzzzzzz");
    const store = createProjectStore(unknown);
    store.execute({ label: "Projekt umbenennen", run: (d) => void (d.name = "Neu") });
    expect(store.getState().project.cameraViews[0]!.upToStoreyId).toBeUndefined();
  });
});

describe("Fixture m6 (1.3)", () => {
  test("Fixture entspricht dem Generator und bleibt beim Laden und Schreiben byteweise gleich", () => {
    const files = readFixture("m6");
    expect(projectToFiles(buildM6())).toEqual(files);
    expect(projectToFiles(load(files))).toEqual(files);
  });

  test("Klima, Ablauf, Spots auf „F3 Licht Wohnen“, Pendel 4000 K und eine Ansicht", () => {
    const p = load(readFixture("m6"));
    const I = M6_IDS;
    expect(p.devices.filter((d) => d.circuitId === I.circuitLight).map((d) => d.id)).toEqual(
      I.spots,
    );
    expect(typeOf(p, I.pendantType)?.light).toEqual({
      kind: "point",
      lumen: 1500,
      colorTempK: 4000,
    });
    expect(p.cables.find((c) => c.id === I.condensateCable)?.to).toEqual({ deviceId: I.drain });
    expect(p.cameraViews.map((v) => v.name)).toEqual(["Küche vom Esstisch"]);
  });
});
