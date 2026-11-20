import {
  calibrate,
  moveUnderlay,
  newUnderlay,
  pdfToWorld,
  rotateUnderlay,
  worldToPdf,
} from "../../../src/geometry/underlay";
import { distance } from "../../../src/geometry/vec";

// Referenzstrecke des Fixture-Vektorplans (tests/fixtures/README.md)
const P1 = { x: 170.1, y: 705.8 };
const P2 = { x: 290.8, y: 705.8 };

describe("Transformation des Planhintergrunds (5.4)", () => {
  test("bemaßte Strecke ergibt nach Kalibrierung 4260 mm, p1 wird Weltursprung", () => {
    const u = calibrate(newUnderlay("plaene/eg.pdf"), P1, P2, 4260);
    expect(pdfToWorld(u, P1)).toEqual({ x: 0, y: 0 });
    expect(distance(pdfToWorld(u, P1), pdfToWorld(u, P2))).toBeCloseTo(4260, 6);
    // y nach unten im PDF wird y nach oben in der Welt
    expect(pdfToWorld(u, { x: P1.x, y: P1.y - 10 }).y).toBeGreaterThan(0);
  });

  test("Welt → PDF ist die Umkehrung", () => {
    let u = calibrate(newUnderlay("a.pdf"), P1, P2, 4260);
    u = rotateUnderlay(moveUnderlay(u, { x: 500, y: -300 }), { x: 1000, y: 1000 }, 12.3);
    const pdf = { x: 400.5, y: 120.25 };
    const back = worldToPdf(u, pdfToWorld(u, pdf));
    expect(back.x).toBeCloseTo(pdf.x, 9);
    expect(back.y).toBeCloseTo(pdf.y, 9);
  });

  test("Neu kalibrieren hält p1 an seiner Weltposition, Drehung bleibt; Wände unverändert", () => {
    let u = calibrate(newUnderlay("a.pdf"), P1, P2, 4260);
    u = rotateUnderlay(moveUnderlay(u, { x: 200, y: 100 }), { x: 0, y: 0 }, 1.5);
    const newP1 = { x: 200, y: 600 };
    const before = pdfToWorld(u, newP1);
    const walls = [{ start: { x: 0, y: 0 }, end: { x: 4260, y: 0 } }];
    const snapshot = structuredClone(walls);
    const re = calibrate(u, newP1, { x: 300, y: 600 }, 3500);
    expect(re.rotationDeg).toBe(1.5);
    expect(pdfToWorld(re, newP1).x).toBeCloseTo(Math.round(before.x), 6);
    expect(pdfToWorld(re, newP1).y).toBeCloseTo(Math.round(before.y), 6);
    expect(distance(pdfToWorld(re, newP1), pdfToWorld(re, { x: 300, y: 600 }))).toBeCloseTo(
      3500,
      6,
    );
    expect(walls).toEqual(snapshot); // Kalibrierung betrifft nur den Hintergrund
  });

  test("Drehen um gewählten Punkt: Drehpunkt bleibt fest", () => {
    const u = moveUnderlay(calibrate(newUnderlay("a.pdf"), P1, P2, 4260), { x: 1000, y: 500 });
    const q = { x: 3000, y: 2000 };
    const qPdf = worldToPdf(u, q);
    const r = rotateUnderlay(u, q, -1.5);
    expect(r.rotationDeg).toBe(-1.5);
    const moved = pdfToWorld(r, qPdf);
    expect(Math.abs(moved.x - q.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(moved.y - q.y)).toBeLessThanOrEqual(1);
  });

  test("Verschieben ändert nur offset; Werte werden beim Setzen gerundet", () => {
    const u = calibrate(newUnderlay("a.pdf"), { x: 10.04, y: 20.06 }, { x: 110, y: 20.06 }, 4260.4);
    expect(u.calibration).toEqual({
      p1: { x: 10, y: 20.1 },
      p2: { x: 110, y: 20.1 },
      distanceMm: 4260,
    });
    const m = moveUnderlay(u, { x: 10.6, y: -3.2 });
    expect(m).toEqual({ ...u, offset: { x: 11, y: -3 } });
  });

  test("unkalibriert: Maßstab 1:100", () => {
    const u = newUnderlay("a.pdf");
    // 72 pt = 1 Zoll = 25,4 mm Papier = 2540 mm bei 1:100
    expect(distance(pdfToWorld(u, { x: 0, y: 0 }), pdfToWorld(u, { x: 72, y: 0 }))).toBeCloseTo(
      2540,
      6,
    );
  });
});
