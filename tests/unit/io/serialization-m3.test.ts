// Dateiformat M3 (Tasks 1.1, 1.4, 1.5): Schema, Ladeprüfung, Migration 2 → 3
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { makeNode, moveNode, splitSegment } from "../../../src/store/routes";
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

/** Zeilen, die sich zwischen zwei Dateiständen unterscheiden. */
function changedLines(a: Record<string, string>, b: Record<string, string>) {
  const changes: string[] = [];
  for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const la = (a[path] ?? "").split("\n");
    const lb = (b[path] ?? "").split("\n");
    if (la.length !== lb.length) {
      changes.push(`${path}: Zeilenzahl`);
      continue;
    }
    la.forEach((line, i) => line !== lb[i] && changes.push(`${path}:${i + 1}`));
  }
  return changes;
}

describe("Aufteilen und Zusammenführen M3 (1.2)", () => {
  test("M3-Fixture: Knoten und Segmente je Geschoss, Durchbruch EG/OG im OG, storeyId gesetzt", () => {
    const p = load(readFixture("m3"));
    expect(p.storeys).toHaveLength(2);
    const og = p.storeys.find((s) => s.slug === "og")!.id;
    expect(p.routeSegments.find((s) => s.id === "s9kern01")!.storeyId).toBe(og);
    expect(p.routeNodes.find((n) => n.id === "n9durch1")!.storeyId).toBe(EG);
    expect(p.cables.map((c) => c.id)).toEqual(["c1licht1", "c2og0001", "c3ohne01"]);
  });
});

describe("Golden Files M3 (1.3)", () => {
  const store = () => createProjectStore(load(readFixture("m3")));

  test("(a) M3-Fixture: Laden → Speichern byteweise identisch für alle Dateien", () => {
    const files = readFixture("m3");
    expect(projectToFiles(load(files))).toEqual(files);
  });

  test("(b) Knoten verschieben ändert genau eine Zeile", () => {
    const s = store();
    const before = projectToFiles(s.getState().project);
    s.execute(moveNode("n4zone02", { surface: "wall:1bih0wst:R", u: 2100, v: 2065 }));
    expect(changedLines(before, projectToFiles(s.getState().project))).toHaveLength(1);
  });

  test("(c) Leitungsstatus ändern ändert nur leitungen.yaml", () => {
    const s = store();
    const before = projectToFiles(s.getState().project);
    s.execute({ label: "Leitung ändern", run: (d) => void (d.cables[0]!.status = "verified") });
    const changes = changedLines(before, projectToFiles(s.getState().project));
    expect(changes).toEqual(["leitungen.yaml:5"]);
  });

  test("(d) Segment teilen ändert die Geschossdatei und die Pfade in leitungen.yaml", () => {
    const s = store();
    const before = projectToFiles(s.getState().project);
    const p = s.getState().project;
    s.execute(
      splitSegment({
        segmentId: "s3zone02",
        node: makeNode(p, "nczweig1", [{ surface: "wall:1bih0wst:R", u: 2800, v: 2065 }]),
        idA: "sczweiga",
        idB: "sczweigb",
      }),
    );
    const after = projectToFiles(s.getState().project);
    const files = new Set(changedLines(before, after).map((c) => c.split(":")[0]));
    expect(files).toEqual(new Set(["geschosse/eg.yaml", "leitungen.yaml"]));
    expect(after["leitungen.yaml"]).toContain(
      'path: ["s1stich1", "sczweigb", "sczweiga", "s4hoch01", "s5decke1"]',
    );
  });
});
