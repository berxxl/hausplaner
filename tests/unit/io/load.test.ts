import { loadProject, type LoadError } from "../../../src/io/load";
import { openingsWithoutWall } from "../../../src/rules/openings";
import { readFixture } from "../fixtures";

function errorsOf(files: Record<string, string>): LoadError[] {
  const result = loadProject(files);
  if (result.status !== "error") throw new Error(`Fehler erwartet, Status ${result.status}`);
  return result.errors;
}

const klein = () => readFixture("klein");
const EG = "geschosse/eg.yaml";

describe("Laden mit Prüfung (2.5)", () => {
  test("leer: keine bekannten Dateien, auch mit fremder katalog.yaml", () => {
    expect(loadProject({}).status).toBe("empty");
    expect(loadProject({ "katalog.yaml": "a: 1\n" }).status).toBe("empty");
  });

  test("Syntaxfehler mit Datei und Zeile", () => {
    const files = klein();
    files[EG] = files[EG]!.replace("    thicknessMm: 300\n", "    thicknessMm: [300\n");
    const [e] = errorsOf(files);
    expect(e!.file).toBe(EG);
    expect(e!.message).toMatch(/YAML-Syntaxfehler/);
    expect(e!.line).toBeGreaterThan(0);
  });

  test("Konfliktmarker mit Datei und Zeile", () => {
    const files = klein();
    const lines = files[EG]!.split("\n");
    lines.splice(12, 0, "<<<<<<< HEAD", "=======", ">>>>>>> og");
    files[EG] = lines.join("\n");
    const errors = errorsOf(files);
    expect(errors.map((e) => [e.file, e.line])).toEqual([
      [EG, 13],
      [EG, 14],
      [EG, 15],
    ]);
  });

  test("Schemaverstoß: falscher Typ mit Zeile", () => {
    const files = klein();
    files[EG] = files[EG]!.replace('kind: "exterior"', 'kind: "aussen"');
    const [e] = errorsOf(files);
    expect(e!.message).toMatch(/walls\[0\]\.kind/);
    expect(e!.line).toBe(files[EG]!.split("\n").indexOf('    kind: "aussen"') + 1);
  });

  test("unbekanntes Feld mit Zeile des Felds", () => {
    const files = klein();
    files[EG] = files[EG]!.replace(
      "    thicknessMm: 300\n",
      '    thicknessMm: 300\n    color: "rot"\n',
    );
    const [e] = errorsOf(files);
    expect(e!.message).toMatch(/Unbekanntes Feld „color“/);
    expect(e!.line).toBe(files[EG]!.split("\n").indexOf('    color: "rot"') + 1);
  });

  test("fehlende schemaVersion ist ein Ladefehler", () => {
    const files = klein();
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 2\n", "");
    const [e] = errorsOf(files);
    expect(e!.message).toMatch(/schemaVersion: Pflichtfeld fehlt/);
  });

  test("neuere schemaVersion: nicht öffnen", () => {
    const files = klein();
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 2", "schemaVersion: 3");
    const [e] = errorsOf(files);
    expect(e!.message).toMatch(/Projekt wurde mit neuerer App-Version erstellt/);
    expect(e!.line).toBe(1);
  });

  test("Slug passt nicht zum Dateinamen", () => {
    const files = klein();
    files["geschosse/og.yaml"] = files[EG]!;
    delete files[EG];
    const errors = errorsOf(files);
    expect(errors[0]!.message).toMatch(/passt nicht zum Dateinamen „og.yaml“/);
  });

  test("doppelte ID über zwei Dateien", () => {
    const files = klein();
    const dg = readFixture("dg")["geschosse/dg.yaml"]!;
    files["geschosse/dg.yaml"] = dg.replace('id: "1c8e0v5r"', 'id: "0aw1s0ud"');
    const errors = errorsOf(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(
      /ID „0aw1s0ud“ ist doppelt \(auch in geschosse\/dg.yaml, Zeile 17\)/,
    );
    expect(errors[0]!.file).toBe(EG);
    expect(errors[0]!.line).toBe(9);
  });

  test("doppelter Slug", () => {
    const files = klein();
    // zweite Datei mit Slug "eg": scheitert am Dateinamen und als Dublette
    files["geschosse/eg2.yaml"] = files[EG]!.replace('id: "e0g1k2m3"', 'id: "e0g1k2m4"').replace(
      /id: "(0|1)(\w)/g,
      'id: "9$2',
    );
    const messages = errorsOf(files).map((e) => e.message);
    expect(messages.some((m) => /Slug „eg“ ist doppelt/.test(m))).toBe(true);
  });

  test("Geschossdatei ohne projekt.yaml", () => {
    const files = klein();
    delete files["projekt.yaml"];
    const [e] = errorsOf(files);
    expect(e!.file).toBe("projekt.yaml");
    expect(e!.message).toMatch(/projekt.yaml fehlt/);
  });

  test("Öffnung mit unbekannter wallId: Projekt öffnet, Warnung opening-without-wall", () => {
    const files = klein();
    files[EG] = files[EG]!.replace('wallId: "0aw1s0ud"', 'wallId: "zzzzzzzz"');
    const result = loadProject(files);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(openingsWithoutWall(result.project)).toEqual([
      { key: "opening-without-wall:o1fenstr", text: "Öffnung ohne Wand (zzzzzzzz)" },
    ]);
  });
});
