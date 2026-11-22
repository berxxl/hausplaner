import {
  alongWallMm,
  drawnOpening,
  MIN_DRAWN_WIDTH_MM,
  movedOpeningOffset,
} from "../../../src/geometry/openings";

const wall = { start: { x: 0, y: 0 }, end: { x: 4000, y: 3000 } }; // 5000 mm lang

describe("Öffnung zeichnen und verschieben (9.2.1)", () => {
  test("Lage entlang der Wand, auf die Wand begrenzt", () => {
    expect(alongWallMm(wall, { x: 800, y: 600 })).toBe(1000);
    // seitlich neben der Achse zählt nur der Anteil entlang der Wand
    expect(alongWallMm(wall, { x: 800 - 300, y: 600 + 400 })).toBe(1000);
    expect(alongWallMm(wall, { x: -400, y: -300 })).toBe(0);
    expect(alongWallMm(wall, { x: 8000, y: 6000 })).toBe(5000);
  });

  test("Aufgezogene Strecke ergibt Abstand und Breite, in beide Richtungen", () => {
    expect(drawnOpening(1000, 2010)).toEqual({ offsetMm: 1000, widthMm: 1010 });
    expect(drawnOpening(2010, 1000)).toEqual({ offsetMm: 1000, widthMm: 1010 });
  });

  test("Zu kurze Strecke zählt als Klick", () => {
    expect(drawnOpening(1000, 1000 + MIN_DRAWN_WIDTH_MM - 1)).toBeNull();
  });

  test("Verschieben bleibt auf der Wand", () => {
    const o = { offsetMm: 1000, widthMm: 1010 };
    expect(movedOpeningOffset(5000, o, 500)).toBe(1500);
    expect(movedOpeningOffset(5000, o, -2000)).toBe(0);
    expect(movedOpeningOffset(5000, o, 9000)).toBe(3990);
  });

  test("Öffnung schon über dem Wandende springt beim Ziehen nicht", () => {
    expect(movedOpeningOffset(4000, { offsetMm: 3500, widthMm: 1010 }, 0)).toBe(3500);
    expect(movedOpeningOffset(4000, { offsetMm: 3500, widthMm: 1010 }, -100)).toBe(3400);
  });
});
