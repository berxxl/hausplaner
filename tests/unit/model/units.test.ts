import {
  formatArea,
  formatDeg,
  formatLength,
  formatM,
  formatMm,
  parseDeg,
  parseMm,
} from "../../../src/model/units";

describe("Zahlenformat (4.6)", () => {
  test("Anzeige", () => {
    expect(formatLength(4260)).toBe("4260 mm (4,26 m)");
    expect(formatMm(12500)).toBe("12500"); // ohne Tausendertrenner
    expect(formatM(1005)).toBe("1,01 m");
    expect(formatArea(12.5e6)).toBe("12,50 m²");
    expect(formatDeg(45)).toBe("45,0°");
    expect(formatDeg(1.54)).toBe("1,5°");
  });

  test("Eingabe in mm: Rundung, Meter, Einheiten", () => {
    expect(parseMm("4,26 m")).toBe(4260);
    expect(parseMm("4.26m")).toBe(4260);
    expect(parseMm("240,6")).toBe(241);
    expect(parseMm("240.4 mm")).toBe(240);
    expect(parseMm(" 4260 ")).toBe(4260);
    expect(parseMm("-120")).toBe(-120);
    expect(parseMm("-0,3")).toBe(0);
    expect(parseMm("0,5 m")).toBe(500);
  });

  test("ungültige Eingaben", () => {
    for (const bad of ["", "abc", "4 260", "4,2,6", "m", "12 cm", "1e3"])
      expect(parseMm(bad)).toBeNull();
  });

  test("Winkel mit Komma oder Punkt", () => {
    expect(parseDeg("1.5")).toBe(1.5);
    expect(parseDeg("1,5")).toBe(1.5);
    expect(parseDeg("1,54°")).toBe(1.5);
    expect(parseDeg("-90")).toBe(-90);
    expect(parseDeg("x")).toBeNull();
  });
});
