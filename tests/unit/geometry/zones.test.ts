import { deriveRoomViews, type RoomView } from "../../../src/geometry/surfaces";
import { feedFor, topAt, viewZones } from "../../../src/geometry/zones";
import { loadProject } from "../../../src/io/load";
import { DEFAULT_INSTALL_ZONES } from "../../../src/model/default-catalog";
import type { Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

function load(name: string): Project {
  const r = loadProject(readFixture(name));
  if (r.status !== "ok") throw new Error();
  return r.project;
}

const Z = DEFAULT_INSTALL_ZONES;
const kitchenSouth = (p: Project) =>
  deriveRoomViews(p)
    .get("r1kueche")!
    .find((v) => v.name === "Wand Süd")!;

/** Flache Wand 4000 mm, Decke 2500 mm über OKFF, optional mit Tür bei 1000–1900. */
function plainView(door = false): Pick<RoomView, "finished" | "top" | "openings"> {
  return {
    finished: { uFrom: 0, uTo: 4000 },
    top: [
      { u: 0, v: 2500 },
      { u: 4000, v: 2500 },
    ],
    openings: door
      ? [
          {
            id: "door0001",
            kind: "door",
            uFrom: 1000,
            uTo: 1900,
            vFrom: 0,
            vTo: 2000,
            raw: {
              uFrom: 985,
              uTo: 1915,
              vFrom: -120,
              vTo: 2015,
              widthMm: 930,
              heightMm: 2135,
              sillMm: 0,
            },
          },
        ]
      : [],
  };
}

describe("Installationszonen (4.1)", () => {
  test("Wand mit Fenster (Spec-Scenario): zwei waagerechte, vier senkrechte Zonen", () => {
    const v = kitchenSouth(load("klein"));
    const win = v.openings.find((o) => o.kind === "window")!;
    const z = viewZones(v, Z);
    expect(z.bottom).toEqual({
      uFrom: v.finished.uFrom,
      uTo: v.finished.uTo,
      vFrom: 150,
      vTo: 450,
    });
    const ceiling = topAt(v, v.finished.uFrom);
    expect(z.top.map((p) => p.v).sort((a, b) => a - b)).toEqual(
      expect.arrayContaining([ceiling - 450, ceiling - 150]),
    );
    expect(z.vertical.map((x) => [x.edge, x.uFrom, x.uTo])).toEqual([
      ["corner-left", v.finished.uFrom + 100, v.finished.uFrom + 300],
      ["corner-right", v.finished.uTo - 300, v.finished.uTo - 100],
      ["reveal-left", win.uFrom - 300, win.uFrom - 100],
      ["reveal-right", win.uTo + 100, win.uTo + 300],
    ]);
    // über die ganze Höhe zwischen OKFF und fertiger Decke
    const corner = z.vertical[0]!;
    expect(Math.min(...corner.polygon.map((p) => p.v))).toBe(0);
    expect(Math.max(...corner.polygon.map((p) => p.v))).toBeCloseTo(ceiling, 6);
  });

  test("Wandöffnung ohne Tür oder Fenster erzeugt keine Laibungszonen", () => {
    const v = plainView(true);
    v.openings[0]!.kind = "opening";
    expect(viewZones(v, Z).vertical).toHaveLength(2);
  });

  test("Zonen werden an den Raumecken beschnitten", () => {
    const v = plainView(true);
    v.openings[0]!.uFrom = 150;
    const left = viewZones(v, Z).vertical.find((x) => x.edge === "reveal-left")!;
    expect([left.uFrom, left.uTo]).toEqual([0, 50]);
  });

  test("Unter Dachschräge (Spec-Scenario): obere Zone folgt der fertigen Deckenkontur", () => {
    const p = load("dg");
    const room = p.rooms[0]!;
    room.plasterMm = 0;
    const gable = deriveRoomViews(p)
      .get(room.id)!
      .find((v) => v.name === "Wand Ost")!;
    const z = viewZones(gable, Z);
    // oberer Rand des Bands = Kontur − 150, unterer = Kontur − 450, auch an den Knicken
    const n = gable.top.length;
    expect(z.top).toHaveLength(2 * n);
    gable.top.forEach((t, i) => {
      expect(z.top[i]!.u).toBeCloseTo(t.u, 6);
      expect(z.top[i]!.v).toBeCloseTo(Math.max(0, t.v - 150), 6);
      expect(z.top[2 * n - 1 - i]!.v).toBeCloseTo(Math.max(0, t.v - 450), 6);
    });
    expect(z.top[0]!.v).toBeCloseTo(2350 - 150, 6);
    expect(z.top[n - 1]!.v).toBeCloseTo(900 - 150, 6);
  });

  test("Obere Zone geändert (Spec-Scenario): 200–500 mm unter der Decke", () => {
    const v = plainView();
    const z = viewZones(v, { ...Z, horizontalTop: [200, 500] });
    expect(z.top.map((p) => p.v)).toEqual([2300, 2300, 2000, 2000]);
  });
});

describe("Zuführung (4.2)", () => {
  test("Schalter 150 mm neben der Türlaibung (Spec-Scenario): von oben, nicht hervorgehoben", () => {
    const f = feedFor(plainView(true), Z, 1000 - 150, 1050)!;
    expect(f).toEqual({ u: 850, vFrom: 1050, vTo: 2050, from: "top", inZone: true });
  });

  test("Schalter mitten auf der Wand (Spec-Scenario): hervorgehoben", () => {
    const f = feedFor(plainView(), Z, 2000, 1050)!;
    expect(f.from).toBe("top");
    expect(f.inZone).toBe(false);
  });

  test("Steckdose in 300 mm (Spec-Scenario): keine Zuführung", () => {
    expect(feedFor(plainView(), Z, 2000, 300)).toBeNull();
  });

  test("Gerät in der oberen Zone: keine Zuführung; darüber von oben herab; unter der unteren Zone von unten", () => {
    expect(feedFor(plainView(), Z, 2000, 2200)).toBeNull();
    expect(feedFor(plainView(), Z, 2000, 2400)).toMatchObject({
      vFrom: 2350,
      vTo: 2400,
      from: "top",
    });
    expect(feedFor(plainView(), Z, 2000, 100)).toMatchObject({
      vFrom: 100,
      vTo: 150,
      from: "bottom",
    });
  });
});
