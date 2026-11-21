// Dateiformat M2 (Tasks 1.1–1.4): Schema, Aufteilen, Writer, Ladeprüfung
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import type { Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

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

describe("Schema M2 (1.1)", () => {
  test("M2-Fixture besteht die Prüfung, Geräte und Möbel erhalten storeyId", () => {
    const p = load(readFixture("m2"));
    expect(p.schemaVersion).toBe(2);
    expect(p.devices).toHaveLength(6);
    expect(p.furniture).toHaveLength(1);
    expect(p.catalog.deviceTypes.map((t) => t.id)).toContain("k7usb2c4");
    expect(p.suppressedWarnings).toEqual(["device-covered:d6usbsch"]);
    const eg = p.storeys[0]!.id;
    expect([...p.devices, ...p.furniture].every((x) => x.storeyId === eg)).toBe(true);
    // connects ist im Modell immer gesetzt, auch wenn es in der Datei fehlt
    expect(p.catalog.deviceTypes.every((t) => Array.isArray(t.connects))).toBe(true);
  });

  test("unbekanntes Feld in einem Gerät ist ein Ladefehler mit Zeile", () => {
    const files = readFixture("m2");
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
      '    label: "Steckdose Küche 1"\n',
      '    label: "Steckdose Küche 1"\n    farbe: "weiß"\n',
    );
    const [e] = errorsOf(files);
    expect(e!.file).toBe("geschosse/eg.yaml");
    expect(e!.message).toMatch(/Unbekanntes Feld „farbe“/);
    expect(files["geschosse/eg.yaml"]!.split("\n")[e!.line! - 1]).toContain("farbe");
  });

  test("ungültige Fläche und ungültiger Zonenbereich werden abgelehnt", () => {
    const files = readFixture("m2");
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
      "wall:0aw1s0ud:L",
      "wall:0aw1s0ud:X",
    );
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("[150, 450]", "[450, 150]");
    const messages = errorsOf(files).map((e) => e.message);
    expect(messages.some((m) => /Ungültige Fläche/.test(m))).toBe(true);
    expect(messages.some((m) => /a < b/.test(m))).toBe(true);
  });
});

describe("Aufteilen und Zusammenführen (1.2)", () => {
  test("Rundreise der M2-Fixture", () => {
    const files = readFixture("m2");
    const p = load(files);
    expect(load(projectToFiles(p))).toEqual(p);
  });

  test("warnungen.yaml fehlt ohne übergangene Warnung; leerer Katalog schreibt keine katalog.yaml", () => {
    const p = load(readFixture("m2"));
    p.suppressedWarnings = [];
    p.catalog = { deviceTypes: [], lineTypes: [], furnitureTypes: [] };
    const out = projectToFiles(p);
    expect(Object.keys(out).sort()).toEqual(["geschosse/eg.yaml", "projekt.yaml"]);
  });

  test("freies Gerät steht in der Datei seines Geschosses", () => {
    const out = projectToFiles(load(readFixture("m2")));
    expect(out["geschosse/eg.yaml"]).toContain('placement: {kind: "free", x: 9000, y: 1500, z: 0}');
  });
});

describe("Golden Files M2 (1.3)", () => {
  test("(a) M2-Fixture: Laden → Speichern byteweise identisch für alle vier Dateien", () => {
    const files = readFixture("m2");
    expect(Object.keys(files).sort()).toEqual([
      "geschosse/eg.yaml",
      "katalog.yaml",
      "projekt.yaml",
      "warnungen.yaml",
    ]);
    expect(projectToFiles(load(files))).toEqual(files);
  });

  test("(b) Gerät verschieben ändert genau eine Zeile", () => {
    const files = readFixture("m2");
    const p = load(files);
    p.devices.find((d) => d.id === "d1steck1")!.placement = {
      kind: "surface",
      surface: "wall:0aw1s0ud:L",
      u: 1271,
      v: 300,
      rotationDeg: 0,
    };
    expect(changedLines(files, projectToFiles(p))).toEqual([
      expect.stringMatching(/^geschosse\/eg\.yaml:\d+$/),
    ]);
  });

  test("(c) Typ ändern ändert nur katalog.yaml", () => {
    const files = readFixture("m2");
    const p = load(files);
    p.catalog.deviceTypes.find((t) => t.id === "switch")!.defaultHeightMm = 1100;
    const changes = changedLines(files, projectToFiles(p));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatch(/^katalog\.yaml:/);
  });

  test("(d) Warnung übergehen ändert nur warnungen.yaml, alphabetisch sortiert", () => {
    const files = readFixture("m2");
    const p = load(files);
    p.suppressedWarnings.push("device-covered:a0000001");
    const out = projectToFiles(p);
    expect(changedLines(files, out).every((c) => c.startsWith("warnungen.yaml"))).toBe(true);
    expect(out["warnungen.yaml"]).toBe(
      'suppressedWarnings:\n  - "device-covered:a0000001"\n  - "device-covered:d6usbsch"\n',
    );
  });
});

describe("Ladeprüfung M2 (1.4)", () => {
  test("doppelte ID zwischen Katalog und Geschossdatei wird gemeldet", () => {
    const files = readFixture("m2");
    files["katalog.yaml"] = files["katalog.yaml"]!.replace('id: "k7usb2c4"', 'id: "d1steck1"');
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replaceAll('"k7usb2c4"', '"d1steck1"');
    const errors = errorsOf(files);
    expect(
      errors.some((e) => /ID „d1steck1“ ist doppelt \(auch in katalog\.yaml/.test(e.message)),
    ).toBe(true);
  });

  test("lesbare Katalog-IDs sind erlaubt, Großbuchstaben nicht", () => {
    const files = readFixture("m2");
    files["katalog.yaml"] = files["katalog.yaml"]!.replace('id: "wardrobe"', 'id: "Schrank"');
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
      'typeId: "wardrobe"',
      'typeId: "Schrank"',
    );
    expect(errorsOf(files).some((e) => /Katalog-ID/.test(e.message))).toBe(true);
  });

  test("Verweise ins Leere öffnen das Projekt (Gerät ohne Typ, Gerät ohne Fläche, Möbel ohne Typ)", () => {
    const files = readFixture("m2");
    files["geschosse/eg.yaml"] = files["geschosse/eg.yaml"]!.replace(
      'typeId: "switch"',
      'typeId: "gibt-es-nicht"',
    )
      .replace("ceiling:r1kueche", "ceiling:zzzzzzzz")
      .replace('typeId: "wardrobe"', 'typeId: "kein-moebel"');
    const p = load(files);
    expect(p.devices.find((d) => d.id === "d2schalt")!.typeId).toBe("gibt-es-nicht");
    expect(p.furniture[0]!.typeId).toBe("kein-moebel");
  });

  test("leere katalog.yaml gilt als leerer Katalog", () => {
    const files = { ...readFixture("klein"), "katalog.yaml": "" };
    expect(load(files).catalog).toEqual({ deviceTypes: [], lineTypes: [], furnitureTypes: [] });
  });
});
