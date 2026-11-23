// Dateiformat M4 (Tasks 1.1–1.5): Schema, Aufteilen, Golden Files, Ladeprüfung, Migration 3 → 4
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { newProject } from "../../../src/model/factory";
import type { Project } from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { readFixture, readV3Fixture } from "../fixtures";
import { buildM4, M4_IDS } from "./fixture-m4.gen.test";

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

/** Geänderte Zeilen je Datei (gleich lange Dateien, Zeile für Zeile). */
function changedLines(a: Record<string, string>, b: Record<string, string>) {
  const out: Record<string, number> = {};
  for (const path of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = (a[path] ?? "").split("\n");
    const y = (b[path] ?? "").split("\n");
    let n = Math.abs(x.length - y.length);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) n++;
    if (n > 0) out[path] = n;
  }
  return out;
}

const EG = "e0g1k2m3";
const OG = "o9g1k2m3";
const I = M4_IDS;

function m4Store() {
  return createProjectStore(load(readFixture("m4")));
}

describe("Schema M4 (1.1)", () => {
  test("M4-Fixture besteht die Prüfung; Verteiler und Reiheneinbaugeräte erhalten das Geschoss", () => {
    const p = load(readFixture("m4"));
    expect(p.schemaVersion).toBe(5);
    expect(p.boards.map((b) => [b.id, b.storeyId])).toEqual([
      [I.meter, EG],
      [I.uvEg, EG],
      [I.uvOg, OG],
      [I.media, EG],
    ]);
    expect(p.devices.find((d) => d.id === I.mcb)!.storeyId).toBe(EG);
    expect(p.devices.find((d) => d.id === I.blindActuator)!.storeyId).toBe(OG);
    expect(p.boards[0]!.fields.map((f) => f.kind)).toEqual(["meter", "apz", "distribution"]);
    expect(p.circuits).toHaveLength(2);
    expect(p.knxAssignments).toEqual([
      { actuatorDeviceId: I.blindActuator, channel: 1, consumerDeviceId: I.shutter },
    ]);
    expect(p.settings).toMatchObject({ teReservePercent: 25, actuatorReservePercent: 20 });
    expect(p.settings.lengthAllowance.perBoardMm).toBe(1500);
  });

  test("Fixture entspricht dem Generator", () => {
    expect(projectToFiles(buildM4())).toEqual(readFixture("m4"));
  });

  test("Endpunkt mit beiden Feldern ist ein Ladefehler", () => {
    const files = readFixture("m4");
    files["leitungen.yaml"] = files["leitungen.yaml"]!.replace(
      'to: {boardId: "b2uveg01"}',
      'to: {deviceId: "d1steck1", boardId: "b2uveg01"}',
    );
    expect(errorsOf(files).some((e) => /genau eins von deviceId und boardId/.test(e.message))).toBe(
      true,
    );
  });

  test("unbekanntes Feld in einem Verteiler ist ein Ladefehler", () => {
    const files = readFixture("m4");
    files["verteiler.yaml"] = files["verteiler.yaml"]!.replace(
      '    mounting: "surface"\n',
      '    mounting: "surface"\n    farbe: "grau"\n',
    );
    const e = errorsOf(files).find((x) => /Unbekanntes Feld „farbe“/.test(x.message));
    expect(e?.file).toBe("verteiler.yaml");
    expect(e?.line).toBe(files["verteiler.yaml"]!.split("\n").indexOf('    farbe: "grau"') + 1);
  });

  test("Verteiler nur auf Wandseiten", () => {
    const files = readFixture("m4");
    files["verteiler.yaml"] = files["verteiler.yaml"]!.replace(
      'surface: "wall:0bw2o0st:L"',
      'surface: "ceiling:r2wohnen"',
    );
    expect(errorsOf(files).some((e) => /Verteiler nur auf Wandseiten/.test(e.message))).toBe(true);
  });

  test("Reiheneinbaugeräte nur in verteiler.yaml, dort keine anderen Geräte", () => {
    const files = readFixture("m4");
    const line =
      '    placement: {kind: "board", boardId: "b2uveg01", fieldId: "f4vert02", row: 1, slot: 1}';
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
      /placement: \{kind: "surface", surface: "wall:0aw1s0ud:L", u: 1200, v: 300, rotationDeg: 0\}/,
      line.trim(),
    );
    files["verteiler.yaml"] = files["verteiler.yaml"]!.replace(
      line,
      '    placement: {kind: "free", x: 0, y: 0, z: 0}',
    );
    const messages = errorsOf(files).map((e) => `${e.file}: ${e.message}`);
    expect(messages).toContain(
      "geschosse/eg.yaml: Reiheneinbaugeräte (placement.kind board) stehen in verteiler.yaml",
    );
    expect(messages).toContain(
      "verteiler.yaml: In verteiler.yaml stehen nur Geräte mit placement.kind board",
    );
  });
});

describe("Aufteilen und Zusammenführen (1.2)", () => {
  test("Rundreise der M4-Fixture", () => {
    const files = readFixture("m4");
    const p = load(files);
    expect(load(projectToFiles(p))).toEqual(p);
    expect(files["geschosse/og.yaml"]).not.toContain('kind: "board"');
    expect(files["verteiler.yaml"]).toContain('  - id: "d9ja0001"\n    label: "JA1"');
  });

  test("verteiler.yaml fehlt ohne Inhalt", () => {
    expect(projectToFiles(load(readFixture("m3")))["verteiler.yaml"]).toBeUndefined();
    const store = m4Store();
    store.execute({
      label: "alles weg",
      run(d) {
        d.boards = [];
        d.circuits = [];
        d.knxLines = [];
        d.knxAssignments = [];
        d.devices = d.devices.filter((x) => x.placement.kind !== "board");
      },
    });
    expect(projectToFiles(store.getState().project)["verteiler.yaml"]).toBeUndefined();
  });
});

describe("Golden Files M4 (1.3)", () => {
  test("(a) M4-Fixture: Laden → Speichern byteweise identisch für alle Dateien", () => {
    const files = readFixture("m4");
    expect(projectToFiles(load(files))).toEqual(files);
  });

  test("(b) Verteiler verschieben ändert genau eine Zeile", () => {
    const store = m4Store();
    const before = projectToFiles(store.getState().project);
    store.execute({
      label: "Verteiler verschieben",
      run: (d) => void (d.boards.find((b) => b.id === I.uvEg)!.placement.u = 2300),
    });
    expect(changedLines(before, projectToFiles(store.getState().project))).toEqual({
      "verteiler.yaml": 1,
    });
  });

  test("(c) Gerät einem Stromkreis zuweisen ändert nur die Geschossdatei", () => {
    const store = m4Store();
    const before = projectToFiles(store.getState().project);
    store.execute({
      label: "Stromkreis zuweisen",
      run: (d) => void (d.devices.find((x) => x.id === "d2schalt")!.circuitId = I.circuitKitchen),
    });
    const after = projectToFiles(store.getState().project);
    expect(Object.keys(changedLines(before, after))).toEqual(["geschosse/eg.yaml"]);
    expect(after["geschosse/eg.yaml"]).toContain(
      '    placement: {kind: "surface", surface: "wall:1bih0wst:R", u: 3500, v: 1050, rotationDeg: 0}\n    circuitId: "k1f1kuec"\n',
    );
  });

  test("(d) Reiheneinbaugerät umsetzen ändert nur verteiler.yaml; Zuordnungen nach Aktor und Kanal", () => {
    const store = m4Store();
    const before = projectToFiles(store.getState().project);
    store.execute({
      label: "Gerät umsetzen",
      run(d) {
        const x = d.devices.find((y) => y.id === I.mcb)!;
        if (x.placement.kind === "board") x.placement.slot = 5;
      },
    });
    expect(changedLines(before, projectToFiles(store.getState().project))).toEqual({
      "verteiler.yaml": 1,
    });
    store.execute({
      label: "Kanal zuordnen",
      run(d) {
        d.knxAssignments.unshift(
          { actuatorDeviceId: I.blindActuator, channel: 3, consumerDeviceId: "d7bodog1" },
          { actuatorDeviceId: I.blindActuator, channel: 2, consumerDeviceId: "d1steck1" },
        );
      },
    });
    expect(projectToFiles(store.getState().project)["verteiler.yaml"]).toContain(
      'knxAssignments:\n  - {actuatorDeviceId: "d9ja0001", channel: 1, consumerDeviceId: "daroll01"}\n  - {actuatorDeviceId: "d9ja0001", channel: 2, consumerDeviceId: "d1steck1"}\n  - {actuatorDeviceId: "d9ja0001", channel: 3, consumerDeviceId: "d7bodog1"}\n',
    );
  });
});

describe("Ladeprüfung M4 (1.4)", () => {
  test("doppelte ID zwischen verteiler.yaml und Geschossdatei wird gemeldet", () => {
    const files = readFixture("m4");
    files["verteiler.yaml"] = files["verteiler.yaml"]!.replace('id: "k2f2kind"', 'id: "d1steck1"');
    expect(errorsOf(files).some((e) => /ID „d1steck1“ ist doppelt/.test(e.message))).toBe(true);
  });

  test("doppelte Feld-ID wird gemeldet", () => {
    const files = readFixture("m4");
    files["verteiler.yaml"] = files["verteiler.yaml"]!.replace('id: "f5vert03"', 'id: "f4vert02"');
    expect(errorsOf(files).some((e) => /ID „f4vert02“ ist doppelt/.test(e.message))).toBe(true);
  });

  test("Verweise ins Leere öffnen das Projekt", () => {
    const files = readFixture("m4");
    files["verteiler.yaml"] = files["verteiler.yaml"]!.replace(
      'surface: "wall:0bw2o0st:L"',
      'surface: "wall:zzzzzzz1:L"',
    )
      .replace(
        'boardId: "b2uveg01", fieldId: "f4vert02"',
        'boardId: "zzzzzzz2", fieldId: "f4vert02"',
      )
      .replace('    boardId: "b3uvog01"\n    lineTypeId', '    boardId: "zzzzzzz3"\n    lineTypeId')
      .replace('protectionDeviceId: "d8lsf101"', 'protectionDeviceId: "zzzzzzz4"')
      .replace('consumerDeviceId: "daroll01"', 'consumerDeviceId: "zzzzzzz5"')
      .replace('parentBoardId: "b1zaehl1"', 'parentBoardId: "zzzzzzz6"');
    files["leitungen.yaml"] = files["leitungen.yaml"]!.replace(
      'to: {boardId: "b4medien"}',
      'to: {boardId: "zzzzzzz7"}',
    );
    files["geschosse/og.yaml"] = files["geschosse/og.yaml"]!.replace(
      'circuitId: "k2f2kind"',
      'circuitId: "zzzzzzz8"',
    );
    const p = load(files);
    // Verteiler auf unbekannter Wand: Geschoss der ersten Geschossdatei
    expect(p.boards.find((b) => b.id === I.meter)!.storeyId).toBe(EG);
    // Reiheneinbaugerät an unbekanntem Verteiler ebenso
    expect(p.devices.find((d) => d.id === I.mcb)!.storeyId).toBe(EG);
  });
});

describe("Migration 3 → 4 (1.5)", () => {
  test("M3-Projekt: Reserven, Verteilerzuschlag, neue Standardtypen; geschrieben erst mit dem ersten Befehl", () => {
    const files = readV3Fixture("m3");
    const result = loadProject(files);
    if (result.status !== "ok") throw new Error(JSON.stringify(result));
    expect(result.notice).toBe(
      "Projekt auf Version 5 aktualisiert, wird beim nächsten Speichern geschrieben",
    );
    expect(result.contents).toEqual(files);
    const p = result.project;
    expect(p.settings).toMatchObject({
      teReservePercent: 25,
      actuatorReservePercent: 20,
      lengthAllowance: { perDeviceMm: 300, perBoardMm: 1500, wastePercent: 10 },
    });
    const store = createProjectStore(p);
    store.execute({ label: "Projekt umbenennen", run: (d) => void (d.name = "Neu") });
    const out = projectToFiles(store.getState().project);
    expect(out["projekt.yaml"]).toMatch(/^schemaVersion: 5\n/);
    expect(out["katalog.yaml"]).toContain('  - id: "knx-switch-actuator-16"\n');
    expect(out["katalog.yaml"]).toContain('  - id: "nym-j-5x10"\n');
    for (const path of Object.keys(files).filter(
      (x) => !["projekt.yaml", "katalog.yaml"].includes(x),
    ))
      expect(out[path]).toBe(files[path]);
    expect(out["verteiler.yaml"]).toBeUndefined();
  });

  test("geänderter Schaltaktor bleibt, fehlende Typen werden ergänzt (Spec-Scenario „Projekt aus M3“)", () => {
    const files = readV3Fixture("m3");
    files["katalog.yaml"] = files["katalog.yaml"]!.replace(
      '    name: "Schaltaktor"\n',
      '    name: "Schaltaktor 12-fach (eigen)"\n',
    ).replace(
      'provides: {function: "switch", channels: 8}',
      'provides: {function: "switch", channels: 12}',
    );
    const p = load(files);
    const types = p.catalog.deviceTypes;
    expect(types.filter((t) => t.id === "knx-switch-actuator")).toEqual([
      expect.objectContaining({
        name: "Schaltaktor 12-fach (eigen)",
        knx: { provides: { function: "switch", channels: 12 } },
      }),
    ]);
    for (const id of ["knx-switch-actuator-16", "patch-panel", "network-switch", "power-supply"])
      expect(types.some((t) => t.id === id)).toBe(true);
    expect(p.catalog.lineTypes.some((t) => t.id === "nym-j-5x10")).toBe(true);
  });

  test("Standardkatalog enthält die M4-Typen; neues Projekt in aktueller Version (Spec-Scenario „Standardkatalog“)", () => {
    const p = newProject("Neu");
    expect(p.schemaVersion).toBe(5);
    const names = p.catalog.deviceTypes.map((t) => t.name);
    for (const n of [
      "Schaltaktor",
      "Schaltaktor 16-fach",
      "Patchfeld 6-fach",
      "Switch 8 Port",
      "Netzteil",
    ])
      expect(names).toContain(n);
    expect(p.catalog.lineTypes.map((t) => t.name)).toContain("NYM-J 5×10");
    expect(p.settings).toMatchObject({ teReservePercent: 25, actuatorReservePercent: 20 });
  });
});
