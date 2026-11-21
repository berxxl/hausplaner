// Rohbauhöhe je Raum (8.1, design.md M2 „Rohbauhöhe je Raum“)
import { finishedCeilingAboveFloor, rawCeilingAt } from "../../../src/geometry/ceiling";
import { deviceWorld } from "../../../src/geometry/devices";
import { roomPolygons } from "../../../src/geometry/model3d";
import { deriveRoomViews, deriveSurfaces, wallSides } from "../../../src/geometry/surfaces";
import { viewZones } from "../../../src/geometry/zones";
import { loadProject } from "../../../src/io/load";
import { DEFAULT_INSTALL_ZONES } from "../../../src/model/default-catalog";
import type { Project } from "../../../src/model/types";
import { editRoom } from "../../../src/store/building";
import { createProjectStore } from "../../../src/store/history";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

/** Fixture m2 mit Bestand 2405 mm; die Küche ist der Anbau mit 2460 mm. */
function anbau(roomHeight: number | null = 2460): Project {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  const p = r.project;
  p.storeys[0]!.rawHeightMm = 2405;
  const kitchen = p.rooms.find((x) => x.id === "r1kueche")!;
  if (roomHeight !== null) kitchen.rawHeightMm = roomHeight;
  return p;
}

const kitchen = (p: Project) => p.rooms.find((x) => x.id === "r1kueche")!;
const storey = (p: Project) => p.storeys[0]!;
const mid = { x: 2000, y: 1500 };

describe("Rohbauhöhe je Raum (8.1)", () => {
  test("Raum mit 2460 mm im Geschoss mit 2405 mm: fertige Decke 2445 mm bei 15 mm Putz (Spec-Scenario)", () => {
    const p = anbau();
    expect(rawCeilingAt(kitchen(p), storey(p), mid)).toBe(2460);
    expect(finishedCeilingAboveFloor(kitchen(p), storey(p), mid) + 120).toBe(2445);
    expect(
      deriveSurfaces(p)
        .find((s) => s.ref === "ceiling:r1kueche")!
        .toWorld(-2000, 1500).z,
    ).toBe(2445);
    // Deckengerät und 3D-Decke folgen
    expect(
      deviceWorld(
        p,
        p.devices.find((d) => d.id === "d3decke1")!,
      )!.z,
    ).toBe(2445);
    const ceiling = roomPolygons(kitchen(p), storey(p)).find((x) => x.kind === "ceiling")!;
    expect(ceiling.z(mid)).toBe(2460);
    // anderer Raum bleibt beim Geschosswert
    const living = p.rooms.find((x) => x.id === "r2wohnen")!;
    expect(rawCeilingAt(living, storey(p), { x: 6000, y: 1500 })).toBe(2405);
  });

  test("Wände behalten ihre Höhe; mit angepasster Wandhöhe folgt die obere Zone der Raumdecke", () => {
    const p = anbau();
    const side = () => wallSides(p, EG).find((s) => s.ref === "wall:1bih0wst:R")!;
    expect(side().wallHeightMm).toBe(2405);
    const view = () =>
      deriveRoomViews(p)
        .get("r1kueche")!
        .find((v) => v.ref === "wall:1bih0wst:R")!;
    // Wand niedriger als die Raumdecke: Oberkante = Wandoberkante
    expect(view().top.every((t) => t.v === 2405 - 120)).toBe(true);
    p.walls.find((w) => w.id === "1bih0wst")!.rawHeightMm = 2460;
    expect(view().top.every((t) => t.v === 2445 - 120)).toBe(true);
    const zones = viewZones(view(), DEFAULT_INSTALL_ZONES);
    expect(Math.max(...zones.top.map((z) => z.v))).toBe(2445 - 120 - 150);
  });

  test("niedrigerer Raum: Wandansicht und Zone folgen ohne Wandänderung", () => {
    const p = anbau(2300);
    const view = deriveRoomViews(p)
      .get("r1kueche")!
      .find((v) => v.ref === "wall:1bih0wst:R")!;
    expect(view.top.every((t) => t.v === 2300 - 15 - 120)).toBe(true);
    expect(Math.min(...viewZones(view, DEFAULT_INSTALL_ZONES).top.map((z) => z.v))).toBe(
      2300 - 15 - 120 - 450,
    );
  });

  test("Feld leer → Geschosswert; Befehl mit Undo", () => {
    const store = createProjectStore(anbau(null));
    const p = () => store.getState().project;
    expect(rawCeilingAt(kitchen(p()), storey(p()), mid)).toBe(2405);
    store.execute(editRoom("r1kueche", { field: "rawHeightMm", value: 2460 }));
    expect(store.undoLabel()).toBe("Rohbauhöhe ändern");
    expect(kitchen(p()).rawHeightMm).toBe(2460);
    store.execute(editRoom("r1kueche", { field: "rawHeightMm", value: undefined }));
    expect("rawHeightMm" in kitchen(p())).toBe(false);
    store.undo();
    expect(kitchen(p()).rawHeightMm).toBe(2460);
  });
});
