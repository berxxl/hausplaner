import {
  finishedCeilingAboveFloor,
  isSlopeValid,
  rawCeilingAt,
  slopeHeight,
} from "../../../src/geometry/ceiling";
import type { Room, Storey } from "../../../src/model/types";

const storey = (over: Partial<Storey> = {}): Storey => ({
  id: "st000001",
  name: "DG",
  slug: "dg",
  elevationMm: 5600,
  rawHeightMm: 2450,
  defaults: { floorBuildupMm: 100, plasterMm: 0, suspendedMm: 0 },
  ...over,
});

const room = (over: Partial<Room> = {}): Room => ({
  id: "ro000001",
  storeyId: "st000001",
  name: "Schlafen",
  seed: { x: 2000, y: 1500 },
  polygon: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ],
  ...over,
});

const south = {
  id: "sl000001",
  baseLine: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
  ] as [{ x: number; y: number }, { x: number; y: number }],
  heightAtBaseMm: 1000,
  angleDeg: 45,
};

describe("Deckenhöhe (6.8)", () => {
  test("flach", () => {
    expect(rawCeilingAt(room(), storey(), { x: 2000, y: 1500 })).toBe(2450);
  });

  test("Abhängung aus Raum und aus Geschoss", () => {
    expect(rawCeilingAt(room({ suspendedMm: 200 }), storey(), { x: 1, y: 1 })).toBe(2250);
    const s = storey({ defaults: { floorBuildupMm: 100, plasterMm: 0, suspendedMm: 50 } });
    expect(rawCeilingAt(room(), s, { x: 1, y: 1 })).toBe(2400);
  });

  test("Kniestock (Spec-Scenario): 1000 mm an der Traufwand, 45°, Aufbau 100, Putz 0 → 900 über OKFF", () => {
    const r = room({ slopes: [south] });
    expect(finishedCeilingAboveFloor(r, storey(), { x: 2000, y: 0 })).toBeCloseTo(900, 9);
    // steigt zur Raumseite: 500 mm weiter innen 500 mm höher
    expect(rawCeilingAt(r, storey(), { x: 2000, y: 500 })).toBeCloseTo(1500, 9);
    // gekappt durch die Rohbauhöhe
    expect(rawCeilingAt(r, storey(), { x: 2000, y: 2900 })).toBe(2450);
    // Richtung der Grundlinie egal: Anstieg immer zum Schwerpunkt
    const reversed = {
      ...south,
      baseLine: [south.baseLine[1], south.baseLine[0]] as typeof south.baseLine,
    };
    expect(slopeHeight(reversed, r.polygon, { x: 2000, y: 500 })).toBeCloseTo(1500, 9);
  });

  test("zwei gegenüberliegende Schrägen: Mitte flach bei 2450, fällt zu beiden Seiten", () => {
    const north = {
      id: "sl000002",
      baseLine: [
        { x: 0, y: 3000 },
        { x: 4000, y: 3000 },
      ] as typeof south.baseLine,
      heightAtBaseMm: 1000,
      angleDeg: 45,
    };
    const r = room({ slopes: [south, north] });
    expect(rawCeilingAt(r, storey(), { x: 2000, y: 1500 })).toBe(2450);
    expect(rawCeilingAt(r, storey(), { x: 2000, y: 200 })).toBeCloseTo(1200, 9);
    expect(rawCeilingAt(r, storey(), { x: 2000, y: 2800 })).toBeCloseTo(1200, 9);
  });

  test("ungültige Schräge: Schwerpunkt auf der Grundlinie wird ignoriert", () => {
    const through = {
      id: "sl000003",
      baseLine: [
        { x: 0, y: 1500 },
        { x: 4000, y: 1500 },
      ] as typeof south.baseLine,
      heightAtBaseMm: 500,
      angleDeg: 30,
    };
    const r = room({ slopes: [through] });
    expect(isSlopeValid(through, r.polygon)).toBe(false);
    expect(isSlopeValid(south, r.polygon)).toBe(true);
    expect(rawCeilingAt(r, storey(), { x: 2000, y: 100 })).toBe(2450);
  });
});
