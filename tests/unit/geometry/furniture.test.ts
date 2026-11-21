import {
  footprint,
  furnitureBaseZ,
  sectionSilhouettes,
  snapFurniture,
} from "../../../src/geometry/furniture";
import { deriveRoomViews } from "../../../src/geometry/surfaces";
import { loadProject } from "../../../src/io/load";
import type { Furniture, Project } from "../../../src/model/types";
import { deviceCoveredWarnings } from "../../../src/rules/furniture";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function m2(): Project {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  return r.project;
}

function furniture(p: Partial<Furniture> & Pick<Furniture, "x" | "y">): Furniture {
  return {
    id: "f9test00",
    typeId: "kitchen-base",
    rotationDeg: 0,
    widthMm: 3000,
    depthMm: 600,
    heightMm: 900,
    elevationMm: 0,
    storeyId: EG,
    ...p,
  };
}

const viewOf = (p: Project, roomId: string, ref: string) =>
  deriveRoomViews(p)
    .get(roomId)!
    .find((v) => v.ref === ref)!;

describe("Grundfläche (5.1)", () => {
  test("Rückseite bei lokal +y, Drehung gegen den Uhrzeigersinn", () => {
    const f = furniture({ x: 0, y: 0, widthMm: 2000, depthMm: 600 });
    expect(footprint(f)).toEqual([
      { x: -1000, y: -300 },
      { x: 1000, y: -300 },
      { x: 1000, y: 300 },
      { x: -1000, y: 300 },
    ]);
    const turned = footprint({ ...f, rotationDeg: 90 }).map((q) => ({
      x: Math.round(q.x) + 0,
      y: Math.round(q.y) + 0,
    }));
    // Rückseite zeigt nach −x
    expect(turned[2]).toEqual({ x: -300, y: 1000 });
  });

  test("Höhe über OKFF bezieht sich auf den Raum der Mitte", () => {
    const p = m2();
    const f = furniture({ x: 2000, y: 1500, elevationMm: 1450 });
    expect(furnitureBaseZ(p, f)).toBe(120 + 1450);
    expect(furnitureBaseZ(p, { ...f, x: 9000 })).toBe(1450);
  });
});

describe("Einrasten (5.1)", () => {
  test("Küchenzeile 3000 × 600 × 900 an der Nordwand bündig an der Putzoberfläche (Spec-Scenario)", () => {
    const p = m2();
    // Nordwand der Küche: Rohbau y = 2940, Putz 15 → fertige Oberfläche y = 2925
    const snapped = snapFurniture(p, EG, furniture({ x: 2000, y: 2500, rotationDeg: 8 }));
    expect(snapped).toEqual({ x: 2000, y: 2925 - 300, rotationDeg: 0 });
  });

  test("ohne Wand in Reichweite, zu stark gedreht oder Rückseite von der Wand weg: kein Einrasten", () => {
    const p = m2();
    expect(snapFurniture(p, EG, furniture({ x: 2000, y: 2300 }))).toBeNull(); // Rückseite 325 mm entfernt
    expect(snapFurniture(p, EG, furniture({ x: 2000, y: 2500, rotationDeg: 20 }))).toBeNull();
    // Vorderseite zur Wand: Rückseite zeigt nach Süden, keine Wand in 200 mm
    expect(snapFurniture(p, EG, furniture({ x: 2000, y: 2500, rotationDeg: 180 }))).toBeNull();
  });

  test("an der Westwand mit Drehung 90°, bündig an der Putzoberfläche", () => {
    const p = m2();
    const snapped = snapFurniture(
      p,
      EG,
      furniture({ x: 600, y: 1500, rotationDeg: 95, widthMm: 1200, depthMm: 600 }),
    );
    // Westwand innen bei x = 150, Putz 15
    expect(snapped).toEqual({ x: 165 + 300, y: 1500, rotationDeg: 90 });
  });
});

describe("Silhouette (5.1)", () => {
  const bed = (y: number) =>
    furniture({
      id: "f8bett00",
      typeId: "bed-160",
      x: 6000,
      y,
      widthMm: 1600,
      depthMm: 2000,
      heightMm: 450,
    });

  test("Bett vor der Wand (Spec-Scenario) ergibt eine Silhouette in der Wandansicht", () => {
    const p = m2();
    p.furniture = [bed(5835 - 1000)];
    const view = viewOf(p, "r4schlaf", "wall:0cw3n0rd:L");
    const [s] = sectionSilhouettes(p, view);
    expect(s).toMatchObject({
      furnitureId: "f8bett00",
      uFrom: 5200,
      uTo: 6800,
      vFrom: 0,
      vTo: 450,
    });
  });

  test("Möbel 150 mm vor der Wand ergibt keine", () => {
    const p = m2();
    p.furniture = [bed(5835 - 1000 - 150)];
    expect(sectionSilhouettes(p, viewOf(p, "r4schlaf", "wall:0cw3n0rd:L"))).toEqual([]);
    p.furniture = [bed(5835 - 1000 - 100)];
    expect(sectionSilhouettes(p, viewOf(p, "r4schlaf", "wall:0cw3n0rd:L"))).toHaveLength(1);
  });

  test("Hängeschrank in 1450 mm: Silhouette schwebt", () => {
    const p = m2();
    p.furniture = [
      furniture({
        x: 2000,
        y: 2925 - 175,
        widthMm: 600,
        depthMm: 350,
        heightMm: 700,
        elevationMm: 1450,
      }),
    ];
    const [s] = sectionSilhouettes(p, viewOf(p, "r1kueche", "wall:1bih0wst:R"));
    expect(s).toMatchObject({ vFrom: 1450, vTo: 2150 });
  });
});

describe("Kollision device-covered (5.3)", () => {
  test("Steckdose hinter Kleiderschrank meldet „Gerät durch Möbel verdeckt“ (Spec-Scenario)", () => {
    const w = deviceCoveredWarnings(m2());
    expect(w).toEqual([
      {
        key: "device-covered:d6usbsch",
        text: "Gerät durch Möbel verdeckt: USB-C Schlafen (Kleiderschrank)",
        target: { kind: "device", id: "d6usbsch" },
      },
    ]);
  });

  test("Steckdose 150 mm über der Arbeitsplatte meldet nichts (Spec-Scenario)", () => {
    const p = m2();
    p.furniture = [furniture({ x: 2000, y: 2625 })];
    const socket = p.devices.find((d) => d.id === "d2schalt")!;
    socket.typeId = "socket";
    socket.placement = {
      kind: "surface",
      surface: "wall:1bih0wst:R",
      u: 2000,
      v: 900 + 150,
      rotationDeg: 0,
    };
    expect(deviceCoveredWarnings(p).map((x) => x.key)).toEqual([]);
    if (socket.placement.kind === "surface") socket.placement.v = 850;
    expect(deviceCoveredWarnings(p).map((x) => x.key)).toEqual(["device-covered:d2schalt"]);
  });

  test("Verschieben neben den Schrank lässt die Warnung verschwinden (Spec-Scenario)", () => {
    const p = m2();
    const d = p.devices.find((x) => x.id === "d6usbsch")!;
    if (d.placement.kind === "surface") d.placement.u = 7300;
    expect(deviceCoveredWarnings(p)).toEqual([]);
  });

  test("Möbel 150 mm vor der Wand verdeckt nicht", () => {
    const p = m2();
    p.furniture[0]!.y -= 165; // Rückseite 150 mm vor der fertigen Oberfläche
    expect(deviceCoveredWarnings(p)).toEqual([]);
  });
});
