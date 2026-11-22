// Blattaufbau (Task 4.1)
import {
  drawingArea,
  fitMessage,
  fits,
  formatDate,
  legendEntries,
  legendItems,
  legendRect,
  neededScale,
  paperSize,
  pdfText,
  scaleBarItems,
  titleBlockItems,
  titleRect,
  type Item,
} from "../../../src/export/sheet";
import { sheetToSvg } from "../../../src/export/svg";
import { defaultCatalog } from "../../../src/model/default-catalog";

const DEFAULT_CATALOG = defaultCatalog();

const A3Q = { paper: "A3", orientation: "landscape" } as const;
const A4H = { paper: "A4", orientation: "portrait" } as const;
const textOf = (items: Item[], data: string) =>
  items.find((i) => i.kind === "text" && i.data === data) as
    Extract<Item, { kind: "text" }> | undefined;

describe("Formate und Zeichenfläche (4.1)", () => {
  test("A3 quer: 420 × 297, Zeichenfläche ohne Rand und unteren Streifen; A4 hoch mit Heftrand", () => {
    expect(paperSize(A3Q)).toEqual({ widthMm: 420, heightMm: 297 });
    expect(drawingArea(A3Q)).toEqual({ x: 10, y: 10, width: 400, height: 237 });
    expect(drawingArea(A3Q, { scaleBar: true }).height).toBe(227);
    expect(paperSize(A4H)).toEqual({ widthMm: 210, heightMm: 297 });
    expect(drawingArea(A4H)).toEqual({ x: 20, y: 10, width: 180, height: 237 });
    // A4 hoch: kein Platz links vom Plankopf, die Legende bekommt einen Streifen
    expect(legendRect(A4H)).toBeNull();
    expect(drawingArea(A4H, { legendStrip: true }).height).toBe(217);
    expect(titleRect(A4H)).toEqual({ x: 20, y: 251, width: 180, height: 36 });
    expect(legendRect(A3Q)).toEqual({ x: 10, y: 251, width: 215, height: 36 });
  });
});

describe("Plankopf, Text, Legende, Maßstabsleiste (4.1)", () => {
  test("Plankopf enthält Projekt, Planinhalt, Geschoss, Maßstab, Datum, Planstand, Planart, Filter", () => {
    const items = titleBlockItems(A3Q, {
      project: "Banatstraße 10",
      content: "Grundriss EG",
      storey: "EG",
      scale: 50,
      date: formatDate(new Date(2026, 10, 22)),
      planStatus: "Entwurf",
      planKind: "Bestandsplan",
      filter: "Strom, KNX",
      page: "1/3",
    });
    const t = (k: string) => textOf(items, `title:${k}`)?.text;
    expect([t("project"), t("content"), t("storey"), t("scale"), t("date")]).toEqual([
      "Banatstraße 10",
      "Grundriss EG",
      "EG",
      "1:50",
      "22.11.2026",
    ]);
    expect([t("planStatus"), t("planKind"), t("filter"), t("page")]).toEqual([
      "Entwurf",
      "Bestandsplan",
      "Strom, KNX",
      "1/3",
    ]);
    // alles innerhalb des Plankopfs
    const r = titleRect(A3Q);
    for (const i of items)
      if (i.kind === "text") {
        expect(i.x).toBeGreaterThanOrEqual(r.x);
        expect(i.y).toBeLessThanOrEqual(r.y + r.height);
      }
  });

  test("pdfText ersetzt Zeichen außerhalb von WinAnsi und behält Umlaute, ß, ×, ·, –, „“, ›", () => {
    expect(pdfText("Küche → Bad ≥ 2 m")).toBe("Küche -> Bad >= 2 m");
    expect(pdfText("NYM-J 3×1,5 · „F1“ – Bad › Wand Nord ½ ß")).toBe(
      "NYM-J 3×1,5 · „F1“ – Bad › Wand Nord ½ ß",
    );
    expect(pdfText("Licht 💡")).toBe("Licht ?");
  });

  test("Legende: Typen nach Name, Verteiler als Rechteck, Überlauf „… und n weitere“", () => {
    const types = DEFAULT_CATALOG.deviceTypes.slice(0, 3);
    const entries = legendEntries(types, true);
    expect(entries.map((e) => e.name)).toEqual([
      ...types.map((t) => t.name).sort((a, b) => a.localeCompare(b, "de")),
      "Verteiler",
    ]);
    const items = legendItems(entries, { x: 0, y: 0, width: 100, height: 36 });
    expect(items.filter((i) => i.data?.startsWith("legend:"))).toHaveLength(4);
    expect(items.some((i) => i.data === "legend-symbol:board")).toBe(true);
    // 1 Spalte × 5 Zeilen: 12 Einträge → 4 sichtbar + „… und 8 weitere“
    const many = legendEntries(DEFAULT_CATALOG.deviceTypes.slice(0, 12), false);
    const small = legendItems(many, { x: 0, y: 0, width: 50, height: 36 });
    expect(textOf(small, "legend:more")?.text).toBe("… und 8 weitere");
  });

  test("Maßstabsleiste: 0–1–2–5 m bei 1:50 sind 100 mm lang", () => {
    const items = scaleBarItems(50, 10, 250);
    const bar = items.find((i) => i.data === "scale-bar") as Extract<Item, { kind: "line" }>;
    expect(bar.x2 - bar.x1).toBeCloseTo(100);
    expect(items.filter((i) => i.kind === "text").map((i) => (i as { text: string }).text)).toEqual(
      ["0", "1", "2", "5 m"],
    );
  });
});

describe("Passprüfung (4.1)", () => {
  test("15 m × 10 m passt in 1:50 nicht auf A3 quer, braucht 1:100", () => {
    const area = drawingArea(A3Q, { scaleBar: true });
    const content = { widthMm: 21000, heightMm: 10000 };
    expect(fits(content, 50, area)).toBe(false);
    expect(neededScale(content, area)).toBe(100);
    expect(fitMessage("Grundriss EG", 50, A3Q, 100)).toBe(
      "Grundriss EG passt in 1:50 nicht auf A3 quer (braucht 1:100)",
    );
    expect(fits({ widthMm: 15000, heightMm: 10000 }, 50, area)).toBe(true);
  });
});

describe("SVG (4.1)", () => {
  test("Breite und Höhe in mm mit viewBox; Texte und Symbole mit ausgeschriebener Farbe", () => {
    const svg = sheetToSvg({
      widthMm: 420,
      heightMm: 297,
      title: {} as never,
      items: [
        { kind: "text", x: 10, y: 20, text: "Bad & WC", size: 2.5, anchor: "middle" },
        { kind: "symbol", svg: "<circle stroke='currentColor'/>", x: 50, y: 50, size: 5 },
      ],
    });
    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="420mm" height="297mm" viewBox="0 0 420 297">/,
    );
    expect(svg).toContain(">Bad &amp; WC</text>");
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain("stroke='#000000'");
    expect(svg).toContain('transform="translate(47.5 47.5) scale(0.05)"');
  });
});
