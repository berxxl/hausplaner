// Symbole (1.7): Positivliste, kanonische Form, Import eigener SVG-Dateien
import { DEFAULT_DEVICE_TYPES } from "../../../src/model/default-catalog";
import { importSvgSymbol, parseSymbol, sanitizeSymbol } from "../../../src/model/symbol";

describe("Symbole (1.7)", () => {
  test.each(DEFAULT_DEVICE_TYPES.map((t) => [t.id, t.symbol]))(
    "Standardsymbol %s ist kanonisch und nicht leer",
    (_, symbol) => {
      expect(parseSymbol(symbol).length).toBeGreaterThan(0);
      expect(sanitizeSymbol(symbol)).toBe(symbol);
    },
  );

  test("Skript, Ereignis-Attribute, href und style werden entfernt (Spec-Scenario „Symbol mit Skript“)", () => {
    const dirty =
      "<script>alert(1)</script><circle cx='50' cy='50' r='20' onload='alert(2)' style='fill:red' stroke='currentColor'/>" +
      "<a href='https://example.com'><rect x='0' y='0' width='10' height='10'/></a>" +
      "<path d='M0 0 L10 10' fill='url(https://example.com/x.svg#p)' stroke='black'/>";
    expect(sanitizeSymbol(dirty)).toBe(
      "<circle cx='50' cy='50' r='20' stroke='currentColor'/><path d='M0 0 L10 10' stroke='black'/>",
    );
  });

  test("Text wird maskiert, verschachtelte Gruppen bleiben erhalten", () => {
    const s = sanitizeSymbol(
      "<g transform='translate(5 5)'><text x='50' y='60' font-size='30'>A&amp;B</text></g>",
    );
    expect(s).toBe(
      "<g transform='translate(5 5)'><text x='50' y='60' font-size='30'>A&amp;B</text></g>",
    );
  });

  test("Import: viewBox 0 0 24 24 wird zentriert auf 0..100 skaliert", () => {
    const result = importSvgSymbol(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" onclick="x()"/></svg>',
    );
    expect(result).toEqual({
      ok: true,
      symbol:
        "<g transform='translate(0 0) scale(4.167)'><circle cx='12' cy='12' r='10' stroke='currentColor' fill='none'/></g>",
    });
  });

  test("Import: schmales Symbol wird mittig gesetzt, viewBox mit Versatz berücksichtigt", () => {
    const result = importSvgSymbol(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 50 100"><rect x="10" y="20" width="50" height="100"/></svg>',
    );
    expect(result.ok && result.symbol).toBe(
      "<g transform='translate(15 -20) scale(1)'><rect x='10' y='20' width='50' height='100'/></g>",
    );
  });

  test("Import: leeres Ergebnis und ungültige Datei werden abgelehnt", () => {
    expect(
      importSvgSymbol('<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>'),
    ).toEqual({ ok: false, error: "Das Symbol enthält keine zulässigen Zeichenelemente" });
    expect(importSvgSymbol("kein svg")).toEqual({
      ok: false,
      error: "Die Datei ist kein gültiges SVG",
    });
  });
});
