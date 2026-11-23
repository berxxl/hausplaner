// Licht in 3D (Task 5.1)
import { loadProject } from "../../../src/io/load";
import {
  kelvinToRgb,
  lightGroups,
  luminousIntensity,
  areaLuminance,
  MAX_LIGHTS,
  rgbHex,
  sceneLights,
  toggleGroup,
} from "../../../src/geometry/lighting";
import type { Device, Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";
import { M6_IDS as I } from "../io/fixture-m6.gen.test";

function m6(): Project {
  const r = loadProject(readFixture("m6"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  return structuredClone(r.project);
}
const EG = "e0g1k2m3";

describe("Lichtfarbe und Lichtstärke", () => {
  test("2700 K ist wärmer als 4000 K (Spec-Scenario „Warmweiß“)", () => {
    const warm = kelvinToRgb(2700);
    const neutral = kelvinToRgb(4000);
    expect(warm.r / warm.b).toBeGreaterThan(neutral.r / neutral.b);
    expect(warm.r).toBe(1);
    expect(kelvinToRgb(6600)).toEqual({ r: 1, g: expect.closeTo(1, 1), b: 1 });
    expect(rgbHex(kelvinToRgb(2700))).toBe("#ffa757");
    expect(rgbHex({ r: 0, g: 0.5, b: 1 })).toBe("#0080ff");
  });

  test("Spot 450 lm mit 36° ergibt rund 1463 cd, Punkt Φ/4π, Fläche Φ/(πA)", () => {
    expect(luminousIntensity("spot", 450, 36)).toBeCloseTo(1463.3, 0);
    expect(luminousIntensity("point", 1000)).toBeCloseTo(79.58, 1);
    expect(areaLuminance(3000, 600, 600)).toBeCloseTo(2652.6, 0);
  });
});

describe("Lichtquellen (5.1)", () => {
  test("vier Spots mit 36° ergeben vier Spotlichter mit 18° nach unten (Spec-Scenario „Spotreihe“)", () => {
    const p = m6();
    const { lights, on } = sceneLights(p, p.devices, new Set(), EG);
    const spots = lights.filter((l) => l.kind === "spot");
    expect(spots.map((l) => l.deviceId)).toEqual(I.spots);
    expect(on).toBe(lights.length);
    for (const s of spots) {
      expect(s.angleDeg).toBe(18);
      expect(s.direction).toEqual({ x: 0, y: 0, z: -1 });
      // Decke Wohnen bei 2485 mm über Rohfußboden, Spot 10 mm tief, 5 mm davor
      expect(s.position.z).toBe(2470);
    }
    expect(spots[0]!.position).toMatchObject({ x: 4900, y: 1500 });
    // Deckenauslass Küche (3000 K) und Pendel Schlafen (4000 K) sind Punktlichter
    const points = lights.filter((l) => l.kind === "point").map((l) => l.deviceId);
    expect(points.sort()).toEqual(["d3decke1", I.pendant]);
    const pendant = lights.find((l) => l.deviceId === I.pendant)!;
    const outlet = lights.find((l) => l.deviceId === "d3decke1")!;
    expect(pendant.color.b).toBeGreaterThan(outlet.color.b);
  });

  test("nur der Kreis der Deckenspots an (Spec-Scenario „Nur Deckenspots“)", () => {
    const p = m6();
    const groups = lightGroups(p, p.devices);
    expect(groups.map((g) => [g.label, g.deviceIds])).toEqual([
      ["F3 Licht Wohnen (UV EG)", I.spots],
      ["ohne Stromkreis", ["d3decke1", I.pendant]],
    ]);
    // alle aus, dann den Kreis an
    let off = new Set(groups.flatMap((g) => g.deviceIds));
    expect(sceneLights(p, p.devices, off, EG).lights).toEqual([]);
    off = toggleGroup(off, groups[0]!.deviceIds);
    expect(sceneLights(p, p.devices, off, EG).lights.map((l) => l.deviceId)).toEqual(I.spots);
    // gemischt → alle an; alle an → alle aus
    off = toggleGroup(new Set([I.spots[0]]), I.spots);
    expect([...off]).toEqual([]);
    expect([...toggleGroup(off, I.spots)]).toEqual(I.spots);
  });

  test("mehr als 32 Leuchten: höchstens 32, oberstes Geschoss zuerst", () => {
    const p = m6();
    const spot = p.devices.find((d) => d.id === I.spots[0])!;
    for (let i = 0; i < 40; i++)
      p.devices.push({
        ...structuredClone(spot),
        id: `dx${String(i).padStart(6, "0")}`,
        placement: { ...spot.placement, u: -4100 - i * 80 } as Device["placement"],
      });
    const og = p.storeys.find((s) => s.id !== EG)!.id;
    const r = sceneLights(p, p.devices, new Set(), og);
    expect(r.on).toBe(46);
    expect(r.lights).toHaveLength(MAX_LIGHTS);
    // kein Licht im OG: Reihenfolge nach ID
    expect(r.lights[0]!.deviceId).toBe("d3decke1");
  });
});
