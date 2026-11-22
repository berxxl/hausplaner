// Dateiformat M3 (Tasks 1.1, 1.4, 1.5): Schema, Ladeprüfung, Migration 2 → 3
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import type { Project } from "../../../src/model/types";
import { readFixture, readV2Fixture } from "../fixtures";

function load(files: Record<string, string>): Project {
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error(JSON.stringify(result));
  return result.project;
}

function errorsOf(files: Record<string, string>) {
  const result = loadProject(files);
  if (result.status !== "error") throw new Error(`erwartet Fehler, war ${result.status}`);
  return result.errors;
}

const EG = "e0g1k2m3";

/** M2-Fixture mit einer kleinen Trasse (Steckdose → Ecke) und einer Leitung. */
function withRoutes(mutate?: (p: Project) => void): Record<string, string> {
  const p = load(readFixture("m2"));
  p.routeNodes.push(
    {
      id: "n1steck1",
      storeyId: EG,
      deviceId: "d1steck1",
      anchors: [{ surface: "wall:0aw1s0ud:L", u: 1200, v: 300 }],
    },
    { id: "n2oben01", storeyId: EG, anchors: [{ surface: "wall:0aw1s0ud:L", u: 1200, v: 2200 }] },
  );
  p.routeSegments.push({
    id: "s1stich1",
    storeyId: EG,
    a: "n2oben01",
    b: "n1steck1",
    kind: "surface",
    surface: "wall:0aw1s0ud:L",
    conduit: { size: "M20", innerDiameterMm: 14.1 },
    status: "planned",
  });
  p.cables.push({
    id: "c1leitg1",
    label: "Steckdose Küche",
    lineTypeId: "nym-j-3x1-5",
    status: "planned",
    from: { deviceId: "d1steck1" },
    to: { deviceId: "d2schalt" },
    path: ["s1stich1"],
  });
  mutate?.(p);
  return projectToFiles(p);
}

describe("Schema M3 (1.1)", () => {
  test("Knoten, Segmente und Leitungen werden geschrieben und gelesen, storeyId gesetzt", () => {
    const files = withRoutes();
    expect(files["geschosse/eg.yaml"]).toContain(
      'routeNodes:\n  - id: "n1steck1"\n    deviceId: "d1steck1"\n    anchors:\n      - {surface: "wall:0aw1s0ud:L", u: 1200, v: 300}\n',
    );
    expect(files["geschosse/eg.yaml"]).toContain(
      '    kind: "surface"\n    surface: "wall:0aw1s0ud:L"\n    conduit: {size: "M20", innerDiameterMm: 14.1}\n    status: "planned"\n',
    );
    expect(files["leitungen.yaml"]).toBe(
      'cables:\n  - id: "c1leitg1"\n    label: "Steckdose Küche"\n    lineTypeId: "nym-j-3x1-5"\n    status: "planned"\n    from: {deviceId: "d1steck1"}\n    to: {deviceId: "d2schalt"}\n    path: ["s1stich1"]\n',
    );
    const p = load(files);
    expect(p.routeNodes.map((n) => n.storeyId)).toEqual([EG, EG]);
    expect(p.routeSegments[0]!.storeyId).toBe(EG);
    expect(p.cables[0]!.path).toEqual(["s1stich1"]);
    expect(projectToFiles(p)).toEqual(files);
  });

  test("leitungen.yaml fehlt ohne Leitung; Leitung ohne Weg schreibt kein path", () => {
    expect(projectToFiles(load(readFixture("m2")))["leitungen.yaml"]).toBeUndefined();
    const files = withRoutes((p) => (p.cables[0]!.path = []));
    expect(files["leitungen.yaml"]).not.toContain("path");
    expect(load(files).cables[0]!.path).toEqual([]);
  });

  test("unbekanntes Feld in einem Segment ist ein Ladefehler", () => {
    const files = withRoutes();
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
      '    status: "planned"\n',
      '    status: "planned"\n    color: "rot"\n',
    );
    expect(errorsOf(files).some((e) => /Unbekanntes Feld „color“/.test(e.message))).toBe(true);
  });

  test("Durchbruch braucht penetration und keine Fläche", () => {
    const files = withRoutes();
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
      '    kind: "surface"\n',
      '    kind: "penetration"\n',
    );
    expect(
      errorsOf(files).some((e) => /penetration nur bei kind penetration/.test(e.message)),
    ).toBe(true);
  });
});

describe("Ladeprüfung M3 (1.4)", () => {
  test("doppelte ID zwischen leitungen.yaml und Geschossdatei wird gemeldet", () => {
    const files = withRoutes();
    files["leitungen.yaml"] = files["leitungen.yaml"]!.replace('id: "c1leitg1"', 'id: "s1stich1"');
    expect(errorsOf(files).some((e) => /ID „s1stich1“ ist doppelt/.test(e.message))).toBe(true);
  });

  test("Verweise ins Leere öffnen das Projekt", () => {
    const files = withRoutes((p) => {
      p.routeNodes[1]!.anchors[0]!.surface = "wall:zzzzzzzz:L";
      p.routeNodes[0]!.deviceId = "zzzzzzz1";
      p.routeSegments[0]!.a = "zzzzzzz2";
      p.cables[0]!.lineTypeId = "unbekannt";
      p.cables[0]!.to = { deviceId: "zzzzzzz3" };
      p.cables[0]!.path = ["s1stich1", "zzzzzzz4"];
    });
    const p = load(files);
    expect(p.cables[0]!.path).toEqual(["s1stich1", "zzzzzzz4"]);
  });
});

describe("Migration 2 → 3 (1.5)", () => {
  test("M2-Projekt: Standardzuschläge, nichts geschrieben bis zum ersten Befehl, sonst nur projekt.yaml", () => {
    const files = readV2Fixture("m2");
    const result = loadProject(files);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.notice).toBe(
      "Projekt auf Version 3 aktualisiert, wird beim nächsten Speichern geschrieben",
    );
    expect(result.contents).toEqual(files);
    expect(result.project.settings.lengthAllowance).toEqual({ perDeviceMm: 300, wastePercent: 10 });
    const out = projectToFiles(result.project);
    expect(out["projekt.yaml"]).toMatch(/^schemaVersion: 3\n/);
    expect(out["projekt.yaml"]).toContain(
      "  lengthAllowance: {perDeviceMm: 300, wastePercent: 10}\n",
    );
    for (const path of Object.keys(files).filter((x) => x !== "projekt.yaml"))
      expect(out[path]).toBe(files[path]);
  });
});
