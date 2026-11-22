// Geräte (3.1–3.3, 3.7): Platzierung, Weltlage, Befehle, Mitlöschen, Höhenbezug, Kombinieren
import {
  deviceWorld,
  finishedWallDistances,
  frontRect,
  planPlacement,
  rawHeightOf,
  viewPlacement,
} from "../../../src/geometry/devices";
import { loadProject } from "../../../src/io/load";
import type { Device, DevicePlacement, Project } from "../../../src/model/types";
import { moveParallel } from "../../../src/geometry/wall-edit";
import {
  addRoom,
  applyWallEdit,
  deleteRoom,
  deleteWall,
  editRoom,
  wallGeoms,
} from "../../../src/store/building";
import { deleteStorey } from "../../../src/store/commands";
import { addDevice, combineDevices, deleteDevices, moveDevice } from "../../../src/store/devices";
import { createProjectStore } from "../../../src/store/history";
import { readFixture } from "../fixtures";

function load(name: string): Project {
  const r = loadProject(readFixture(name));
  if (r.status !== "ok") throw new Error();
  return r.project;
}
const typeOf = (p: Project, id: string) => p.catalog.deviceTypes.find((t) => t.id === id)!;
const EG = "e0g1k2m3";

function device(id: string, placement: DevicePlacement, typeId = "socket"): Device {
  return { id, label: id, typeId, status: "planned", placement, storeyId: EG };
}
const onWall = (surface: string, u: number, v: number): DevicePlacement => ({
  kind: "surface",
  surface,
  u,
  v,
  rotationDeg: 0,
});

describe("Platzierung im Grundriss (3.1)", () => {
  const p = load("m2");
  const sw = typeOf(p, "switch");

  test("Klick neben der Wand ordnet der Wandseite auf der Seite des Klicks zu (Spec-Scenario „Schalter im Grundriss“)", () => {
    // Wand Küche/Bad bei y = 3000, Dicke 120: Küche liegt bei y < 3000 (Seite R), Bad bei y > 3000 (L)
    expect(planPlacement(p, EG, sw, { x: 2000, y: 2900 })).toEqual({
      ok: true,
      placement: onWall("wall:1bih0wst:R", 2000, 1050),
    });
    const other = planPlacement(p, EG, sw, { x: 2000, y: 3100 });
    expect(other.ok && other.placement).toMatchObject({ surface: "wall:1bih0wst:L", v: 1050 });
    // im Wandkörper: Seite nach der Hälfte, in der geklickt wurde
    const inside = planPlacement(p, EG, sw, { x: 2000, y: 3020 });
    expect(inside.ok && inside.placement).toMatchObject({ surface: "wall:1bih0wst:L" });
  });

  test("350 mm vor der Wand trifft keine Wandseite: Typ nur für Wand wird abgelehnt", () => {
    // fertige Oberfläche bei 2940 − 15 = 2925; 2925 − 300 = 2625
    expect(planPlacement(p, EG, sw, { x: 2000, y: 2590 })).toEqual({
      ok: false,
      error: "Schalter ist nur für Wand zulässig",
    });
    expect(planPlacement(p, EG, sw, { x: 2000, y: 2640 }).ok).toBe(true);
  });

  test("Deckentyp im Raum → Decke mit (u, v) = (−x, y); freier Typ außerhalb aller Räume → frei", () => {
    expect(planPlacement(p, EG, typeOf(p, "ceiling-outlet"), { x: 2000, y: 1500 })).toEqual({
      ok: true,
      placement: onWall("ceiling:r1kueche", -2000, 1500),
    });
    expect(planPlacement(p, EG, typeOf(p, "ac-outdoor"), { x: 9000, y: 1500 })).toEqual({
      ok: true,
      placement: { kind: "free", x: 9000, y: 1500, z: 0 },
    });
  });

  test("Schräge, deren Fläche über dem Punkt am tiefsten liegt; dahinter die flache Decke", () => {
    const dg = load("dg");
    dg.catalog = load("m2").catalog;
    const presence = typeOf(dg, "presence-knx");
    const storey = dg.storeys[0]!.id;
    // Schräge steigt von y = 150 (1000 mm) mit 45°; flache Decke 2450 mm ab y = 1600
    const low = planPlacement(dg, storey, presence, { x: 2000, y: 800 });
    expect(low.ok && low.placement).toMatchObject({ surface: "slope:m3x8c2pd:s7m2k4qa" });
    const high = planPlacement(dg, storey, presence, { x: 2000, y: 2500 });
    expect(high.ok && high.placement).toMatchObject({ surface: "ceiling:m3x8c2pd" });
  });

  test("Flächenansicht: Steckdose in 300 mm (Spec-Scenario), Präsenzmelder an der Wand abgelehnt (Spec-Scenario)", () => {
    expect(viewPlacement(typeOf(p, "socket"), "wall:0aw1s0ud:L", 1834.4, 1222)).toEqual({
      ok: true,
      placement: onWall("wall:0aw1s0ud:L", 1834, 300),
    });
    expect(viewPlacement(typeOf(p, "presence-knx"), "wall:0aw1s0ud:L", 1000, 1000)).toEqual({
      ok: false,
      error: "Präsenzmelder KNX ist nur für Decke zulässig",
    });
    // Schrägen nehmen Deckentypen auf
    expect(viewPlacement(typeOf(p, "presence-knx"), "slope:aaaaaaaa:bbbbbbbb", 10, 20).ok).toBe(
      true,
    );
  });

  test("Weltlage: Wandgerät auf der fertigen Oberfläche, z = v + Fußbodenaufbau; Frontrechteck", () => {
    const d = p.devices.find((x) => x.id === "d1steck1")!; // wall:0aw1s0ud:L, u 1200, v 300
    // Seite L: Ursprung am Wandende (8000, 150), u läuft nach −x; Wohnen: Putz 15, Aufbau 120
    expect(deviceWorld(p, d)).toEqual({ x: 6800, y: 165, z: 420, normal: { x: 0, y: 1, z: 0 } });
    expect(rawHeightOf(p, d)).toBe(420);
    expect(frontRect(d, typeOf(p, "socket"))).toEqual({
      uMin: 1160,
      uMax: 1240,
      vMin: 260,
      vMax: 340,
    });
    const ceiling = deviceWorld(
      p,
      p.devices.find((x) => x.id === "d3decke1")!,
    )!;
    expect(ceiling).toMatchObject({ x: 2000, y: 1500, z: 2485 });
  });
});

describe("Befehle und Mitlöschen (3.2)", () => {
  test("Wand mit zwei Steckdosen löschen nimmt beide mit; Rückgängig stellt alles her (Spec-Scenario „Wand gelöscht“)", () => {
    const store = createProjectStore(load("m2"));
    store.execute(addDevice(device("x0000001", onWall("wall:0aw1s0ud:R", 500, 300))));
    const before = store.getState().project.devices.length;
    store.execute(deleteWall("0aw1s0ud"));
    const ids = store.getState().project.devices.map((d) => d.id);
    expect(ids).not.toContain("d1steck1");
    expect(ids).not.toContain("x0000001");
    expect(ids).toHaveLength(before - 2);
    store.undo();
    expect(store.getState().project.devices).toHaveLength(before);
    expect(store.getState().project.walls.some((w) => w.id === "0aw1s0ud")).toBe(true);
  });

  test("Raum löschen nimmt Decken- und Bodengeräte mit, Wandgeräte bleiben; Geschoss löschen nimmt alles", () => {
    const store = createProjectStore(load("m2"));
    store.execute(deleteRoom("r1kueche"));
    const ids = store.getState().project.devices.map((d) => d.id);
    expect(ids).not.toContain("d3decke1");
    expect(ids).toContain("d2schalt");
    store.execute(deleteStorey(EG));
    expect(store.getState().project.devices).toEqual([]);
    expect(store.getState().project.furniture).toEqual([]);
  });

  test("Gerät verschieben und löschen sind einzelne Schritte", () => {
    const store = createProjectStore(load("m2"));
    store.execute(moveDevice("d1steck1", onWall("wall:0aw1s0ud:L", 1300, 300)));
    expect(store.undoLabel()).toBe("Gerät verschieben");
    store.execute(deleteDevices(["d1steck1", "d2schalt"]));
    expect(store.getState().project.devices.map((d) => d.id)).not.toContain("d2schalt");
    store.undo();
    expect(store.getState().project.devices.find((d) => d.id === "d1steck1")!.placement).toEqual(
      onWall("wall:0aw1s0ud:L", 1300, 300),
    );
  });
});

describe("Höhenbezug bei geänderter Raumzuordnung (3.3)", () => {
  test("Raum nachträglich angelegt: 400 mm über Rohfußboden → 300 mm über OKFF bei 100 mm Aufbau (Spec-Scenario)", () => {
    const p = load("m2");
    const bad = p.rooms.find((r) => r.id === "r3bad00a")!;
    p.rooms = p.rooms.filter((r) => r.id !== bad.id);
    const store = createProjectStore(p);
    // Seite L der Wand Küche/Bad zeigt zum Bad, das es noch nicht gibt
    store.execute(addDevice(device("x0000002", onWall("wall:1bih0wst:L", 2000, 400))));
    store.execute(addRoom({ ...bad, floorBuildupMm: 100 }));
    const d = store.getState().project.devices.find((x) => x.id === "x0000002")!;
    expect(d.placement).toMatchObject({ v: 300 });
    expect(rawHeightOf(store.getState().project, d)).toBe(400);
    store.undo();
    expect(
      store.getState().project.devices.find((x) => x.id === "x0000002")!.placement,
    ).toMatchObject({ v: 400 });
  });

  test("Estrich geändert: Höhe über OKFF bleibt, Rohbauhöhe 1050 + 140 = 1190 (Spec-Scenario)", () => {
    const p = load("m2");
    p.rooms.find((r) => r.id === "r1kueche")!.floorBuildupMm = 100;
    const store = createProjectStore(p);
    store.execute(editRoom("r1kueche", { field: "floorBuildupMm", value: 140 }));
    const d = store.getState().project.devices.find((x) => x.id === "d2schalt")!;
    expect(d.placement).toMatchObject({ v: 1050 });
    expect(rawHeightOf(store.getState().project, d)).toBe(1190);
  });

  test("Raum gelöscht: Rohbauhöhe bleibt, v bezieht sich danach auf den Rohfußboden", () => {
    const store = createProjectStore(load("m2"));
    store.execute(deleteRoom("r1kueche"));
    expect(
      store.getState().project.devices.find((x) => x.id === "d2schalt")!.placement,
    ).toMatchObject({ v: 1050 + 120 });
  });

  test("Wand verschoben: Dose wechselt vom Bad (140 mm) ins Schlafen (120 mm), Rohbauhöhe bleibt", () => {
    const store = createProjectStore(load("m2"));
    // Seite L der Nordwand (y = 6000) zeigt nach −y; u = x
    store.execute(addDevice(device("x0000003", onWall("wall:0cw3n0rd:L", 3500, 300))));
    const p = store.getState().project;
    expect(
      rawHeightOf(
        p,
        p.devices.find((d) => d.id === "x0000003")!,
      ),
    ).toBe(440);
    // Trennwand Bad/Schlafen (x = 4000, läuft nach +y) um 1000 mm nach links (−x)
    store.execute(
      applyWallEdit(EG, moveParallel(wallGeoms(p, EG), "1aiv0ert", 1000), "Wand verschieben"),
    );
    const q = store.getState().project;
    const moved = q.devices.find((d) => d.id === "x0000003")!;
    expect(moved.placement).toMatchObject({ v: 320 });
    expect(rawHeightOf(q, moved)).toBe(440);
  });

  test("vom Befehl selbst verschobene Geräte werden nicht angepasst", () => {
    const store = createProjectStore(load("m2"));
    store.execute({
      label: "Test",
      run(draft) {
        draft.rooms = draft.rooms.filter((r) => r.id !== "r1kueche");
        const d = draft.devices.find((x) => x.id === "d2schalt")!;
        if (d.placement.kind === "surface") d.placement.v = 900;
      },
    });
    expect(
      store.getState().project.devices.find((x) => x.id === "d2schalt")!.placement,
    ).toMatchObject({ v: 900 });
  });
});

describe("Kombinieren (3.7)", () => {
  function withThree() {
    const store = createProjectStore(load("m2"));
    for (const [id, u, v] of [
      ["k0000001", 2000, 1000],
      ["k0000002", 1700, 1060],
      ["k0000003", 2600, 1100],
    ] as const)
      store.execute(addDevice(device(id, onWall("wall:0aw1s0ud:L", u, v))));
    return store;
  }
  const uvOf = (s: ReturnType<typeof withThree>, id: string) => {
    const p = s.getState().project.devices.find((d) => d.id === id)!.placement;
    return p.kind === "surface" ? { u: p.u, v: p.v } : null;
  };

  test("drei Geräte waagerecht: eine Höhe, Abstand 71 mm (Spec-Scenario „Dreifachkombination“)", () => {
    const store = withThree();
    const r = combineDevices(
      store.getState().project,
      ["k0000001", "k0000002", "k0000003"],
      "horizontal",
    );
    if (!r.ok) throw new Error(r.error);
    store.execute(r.command);
    expect(uvOf(store, "k0000002")).toEqual({ u: 1700, v: 1060 });
    expect(uvOf(store, "k0000001")).toEqual({ u: 1771, v: 1060 });
    expect(uvOf(store, "k0000003")).toEqual({ u: 1842, v: 1060 });
    expect(store.undoLabel()).toBe("Geräte kombinieren");
  });

  test("senkrecht mit eigenem Abstand: oberstes bleibt, die anderen darunter", () => {
    const store = withThree();
    const r = combineDevices(
      store.getState().project,
      ["k0000001", "k0000002", "k0000003"],
      "vertical",
      80,
    );
    if (!r.ok) throw new Error(r.error);
    store.execute(r.command);
    expect(uvOf(store, "k0000003")).toEqual({ u: 2600, v: 1100 });
    expect(uvOf(store, "k0000002")).toEqual({ u: 2600, v: 1020 });
    expect(uvOf(store, "k0000001")).toEqual({ u: 2600, v: 940 });
  });

  test("verschiedene Flächen oder nur ein Gerät werden abgelehnt", () => {
    const p = load("m2");
    expect(combineDevices(p, ["d1steck1", "d2schalt"], "horizontal")).toEqual({
      ok: false,
      error: "Kombinieren nur auf einer Fläche",
    });
    expect(combineDevices(p, ["d1steck1"], "horizontal").ok).toBe(false);
  });
});

describe("Abstände zur fertigen Wand (design.md „Bezug und Bemaßung“)", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ];

  test("vier Richtungen, um den Putz versetzt", () => {
    const d = finishedWallDistances(square, 15, { x: 1000, y: 2000 });
    expect(d.left).toBeCloseTo(985, 3);
    expect(d.right).toBeCloseTo(2985, 3);
    expect(d.down).toBeCloseTo(1985, 3);
    expect(d.up).toBeCloseTo(985, 3);
  });

  test("L-förmiger Raum: nächste Wand in Strahlrichtung", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 1000 },
      { x: 2000, y: 1000 },
      { x: 2000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    const d = finishedWallDistances(l, 0, { x: 3000, y: 500 });
    expect(d).toEqual({ left: 3000, right: 1000, up: 500, down: 500 });
  });
});
