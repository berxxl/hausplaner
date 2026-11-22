// Belegung, Tabellenblätter, Auswahl (Tasks 5.3, 5.4)
import { boardSheets } from "../../../src/export/board";
import type { ExportOptions } from "../../../src/export/compose";
import {
  buildSheets,
  EMPTY_SELECTION,
  setStorey,
  surfaceTargets,
} from "../../../src/export/selection";
import { drawingArea, type Item } from "../../../src/export/sheet";
import { columnWidths, fitText, layoutTables, listSheets } from "../../../src/export/table";
import { deriveRoomViews } from "../../../src/geometry/surfaces";
import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

const OPTS: ExportOptions = {
  format: { paper: "A3", orientation: "landscape" },
  scale: 50,
  project: "Test",
  date: "22.11.2026",
  planStatus: "Entwurf",
  trades: ["power", "knx", "data", "conduit", "refrigerant", "condensate", "other"],
  statuses: ["planned", "installed", "verified"],
};

function m4(mutate?: (p: Project) => void): Project {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return r.project;
}

const data = (items: Item[], prefix: string) => items.filter((i) => i.data?.startsWith(prefix));

describe("Belegung als Blatt (5.3)", () => {
  test("UV EG: Feld, LS mit Beschriftung, Zusammenfassung und Stromkreistabelle auf einem Blatt im Rand", () => {
    const sheets = boardSheets(m4(), "b2uveg01", OPTS);
    expect(sheets).toHaveLength(1);
    const { sheet, content, fit } = sheets[0]!;
    expect(content).toBe("Belegung UV EG");
    expect(fit).toBeNull();
    expect(sheet.title.scale).toBeNull();
    expect(data(sheet.items, "board-device:d8lsf101")).toHaveLength(1);
    expect(data(sheet.items, "board-label:d8lsf101")[0]).toMatchObject({ rotate: -90 });
    expect(data(sheet.items, "board-summary")[0]).toMatchObject({
      text: expect.stringMatching(/^UV EG: 1 belegt/),
    });
    expect(data(sheet.items, "row:k1f1kuec")).toHaveLength(1);
    const area = drawingArea(OPTS.format);
    for (const i of data(sheet.items, "field:"))
      if (i.kind === "poly")
        for (const [x, y] of i.points) {
          expect(x).toBeLessThanOrEqual(area.x + area.width + 1e-6);
          expect(y).toBeLessThanOrEqual(area.y + area.height + 1e-6);
        }
  });
});

describe("Listen als Tabellenblätter (5.3)", () => {
  test("Leitungsliste mit 120 Zeilen: mehrere Seiten mit Kopf, Summe auf der letzten, Seitenzahl", () => {
    const p = m4((q) => {
      const c1 = q.cables.find((c) => c.id === "c1licht1")!;
      for (let i = 0; i < 120; i++)
        q.cables.push({ ...c1, id: `cx${String(i).padStart(6, "0")}`, label: `Leitung ${i}` });
    });
    const sheets = listSheets(p, "cables", OPTS);
    expect(sheets.length).toBeGreaterThan(1);
    for (const s of sheets) {
      expect(s.content).toBe("Liste Leitungen");
      expect(
        s.sheet.items.some((i) => i.kind === "text" && i.text === "Bezeichnung" && i.bold),
      ).toBe(true);
    }
    expect(sheets.map((s) => s.sheet.title.page)).toEqual(
      sheets.map((_, i) => `${i + 1}/${sheets.length}`),
    );
    expect(data(sheets.at(-1)!.sheet.items, "summary").length).toBeGreaterThan(0);
    expect(sheets.slice(0, -1).every((s) => data(s.sheet.items, "summary").length === 0)).toBe(
      true,
    );
    const rowCount = sheets.flatMap((s) => data(s.sheet.items, "row:")).length;
    expect(rowCount).toBe(p.cables.length);
  });

  test("Spaltenbreiten passen in die Breite, zu lange Zellen enden mit „…“", () => {
    expect(fitText("Netzwerkdose Wohnen – Medienverteiler", 20)).toBe("Netzwerkdose Wo…");
    const block = {
      columns: [
        { key: "a", label: "A" },
        { key: "b", label: "Bezeichnung" },
      ],
      rows: [
        {
          id: "1",
          cells: { a: { text: "x".repeat(200), sort: "x" }, b: { text: "kurz", sort: "k" } },
        },
      ],
      summary: [],
    };
    const widths = columnWidths(block, 100);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(widths[1]).toBeGreaterThanOrEqual(11 * 1.25 + 2 - 1e-6);
    const pages = layoutTables([block], { x: 0, y: 0, width: 100, height: 100 });
    const cell = pages[0]!.find((i) => i.data === "row:1") as Extract<Item, { kind: "text" }>;
    expect(cell.text.endsWith("…")).toBe(true);
  });

  test("Materialliste: ein Block je Abschnitt mit Überschrift", () => {
    const sheets = listSheets(m4(), "material", OPTS);
    const titles = sheets
      .flatMap((s) => data(s.sheet.items, "block:"))
      .map((i) => i.data!.slice(6));
    expect(titles).toEqual([
      "Geräte je Typ",
      "Unterputzdosen",
      "Leitungen je Typ",
      "Leerrohre je Nenngröße",
      "Reiheneinbaugeräte",
    ]);
  });
});

describe("Auswahl → Blätter (5.4)", () => {
  test("„Bad, alle Wandansichten“ ergibt je Wandseite des Bads ein Blatt (Spec-Scenario „Alle Wände eines Raums“)", () => {
    const p = m4();
    const sheets = buildSheets(
      p,
      { ...EMPTY_SELECTION, walls: ["r3bad00a"] },
      { ...OPTS, scale: 20 },
    );
    const views = deriveRoomViews(p).get("r3bad00a")!;
    expect(views.length).toBeGreaterThan(0);
    expect(sheets.map((s) => s.content)).toEqual(views.map((v) => `Bad › ${v.name}`));
  });

  test("Geschoss setzt Grundriss, alle Räume und Flächen ohne Raum; Reihenfolge Grundriss, Flächen, Belegung, Listen", () => {
    const p = m4();
    let sel = setStorey(p, EMPTY_SELECTION, "o9g1k2m3", true);
    expect(sel.plans).toEqual(["o9g1k2m3"]);
    expect(sel.walls).toEqual(["r9kind01"]);
    expect(sel.freeSurfaces).toEqual(["o9g1k2m3"]);
    sel = { ...sel, boards: ["b3uvog01"], lists: ["circuits"] };
    const contents = buildSheets(p, sel, { ...OPTS, scale: 100 }).map((s) => s.content);
    expect(contents[0]).toBe("Grundriss OG");
    expect(contents.indexOf("Kind › Decke")).toBeGreaterThan(0);
    expect(contents.at(-2)).toBe("Belegung UV OG");
    expect(contents.at(-1)).toBe("Liste Stromkreise");
    expect(surfaceTargets(p, setStorey(p, sel, "o9g1k2m3", false))).toEqual([]);
  });
});
