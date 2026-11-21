import { moveParallel } from "../../../src/geometry/wall-edit";
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import { computeWarnings } from "../../../src/rules";
import {
  addOpening,
  addSlope,
  addWall,
  applyWallEdit,
  deleteRoom,
  deleteSlope,
  deleteWall,
  editOpening,
  editRoom,
  wallGeoms,
} from "../../../src/store/building";
import { createProjectStore } from "../../../src/store/history";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function open() {
  const result = loadProject(readFixture("klein"));
  if (result.status !== "ok") throw new Error();
  return createProjectStore(result.project);
}

const room = (store: ReturnType<typeof open>, id: string) =>
  store.getState().project.rooms.find((r) => r.id === id)!;
const keys = (store: ReturnType<typeof open>) =>
  computeWarnings(store.getState().project).map((w) => w.key);

describe("Räume folgen den Wänden (6.5)", () => {
  test("Wand verschoben: Kontur passt sich im selben Befehl an; Undo stellt beides her", () => {
    const store = open();
    const before = room(store, "r1kueche").polygon;
    const p = store.getState().project;
    // Westwand 100 mm nach außen (läuft nach −y, links = +x → außen = −100)
    store.execute(
      applyWallEdit(EG, moveParallel(wallGeoms(p, EG), "0dw4w0st", -100), "Wand verschieben"),
    );
    expect(room(store, "r1kueche").polygon[0]).toEqual({ x: 50, y: 150 });
    expect(room(store, "r3bad00a").polygon[0]).toEqual({ x: 50, y: 3060 });
    expect(store.getState().undoStack).toHaveLength(1);
    store.undo();
    expect(room(store, "r1kueche").polygon).toEqual(before);
  });

  test("Wandänderung an Raum A lässt die Zeilen von Raum B in der Geschossdatei unverändert", () => {
    const store = open();
    const lines = (s: string) => s.split("\n");
    const before = lines(projectToFiles(store.getState().project)["geschosse/eg.yaml"]!);
    const p = store.getState().project;
    // Südwand nur unter Küche und Wohnen; Bad und Schlafen (r3, r4) bleiben
    store.execute(
      applyWallEdit(EG, moveParallel(wallGeoms(p, EG), "0aw1s0ud", -100), "Wand verschieben"),
    );
    const after = lines(projectToFiles(store.getState().project)["geschosse/eg.yaml"]!);
    const block = (ls: string[], id: string) => {
      const i = ls.indexOf(`  - id: "${id}"`);
      let j = i + 1;
      while (j < ls.length && !ls[j]!.startsWith("  - ") && !/^\S/.test(ls[j]!)) j++;
      return ls.slice(i, j);
    };
    expect(block(after, "r3bad00a")).toEqual(block(before, "r3bad00a"));
    expect(block(after, "r4schlaf")).toEqual(block(before, "r4schlaf"));
    expect(block(after, "r1kueche")).not.toEqual(block(before, "r1kueche"));
  });

  test("Außenwand gelöscht: Kontur bleibt, Warnung room-open; Trennwand gelöscht: room-merged an beiden", () => {
    const store = open();
    const kitchen = room(store, "r1kueche").polygon;
    store.execute(deleteWall("0aw1s0ud"));
    expect(room(store, "r1kueche").polygon).toEqual(kitchen);
    expect(keys(store)).toEqual(
      expect.arrayContaining(["room-open:r1kueche", "room-open:r2wohnen"]),
    );
    store.undo();
    store.execute(deleteWall("1bih0wst")); // Trennwand Küche / Bad
    expect(keys(store)).toEqual(
      expect.arrayContaining(["room-merged:r1kueche", "room-merged:r3bad00a"]),
    );
    expect(
      computeWarnings(store.getState().project).find((w) => w.key === "room-merged:r1kueche")?.text,
    ).toBe("Raum mit Bad verschmolzen");
  });

  test("Wand löschen entfernt ihre Öffnungen; Undo stellt Wand und Öffnung wieder her", () => {
    const store = open();
    store.execute(deleteWall("0aw1s0ud"));
    expect(store.getState().project.openings.map((o) => o.id)).toEqual(["o2tuer00"]);
    store.undo();
    expect(
      store
        .getState()
        .project.openings.map((o) => o.id)
        .sort(),
    ).toEqual(["o1fenstr", "o2tuer00"]);
    expect(store.getState().project.walls).toHaveLength(7);
  });

  test("neue Wand teilt einen Raum: Raum behält den Teil mit seinem Saatpunkt", () => {
    const store = open();
    store.execute(
      addWall({
        id: "newwall1",
        storeyId: EG,
        kind: "interior",
        start: { x: 0, y: 1000 },
        end: { x: 4000, y: 1000 },
        thicknessMm: 100,
      }),
    );
    // Saatpunkt der Küche (2000, 1500) liegt oberhalb der neuen Wand
    expect(room(store, "r1kueche").polygon[0]).toEqual({ x: 150, y: 1050 });
  });
});

describe("Wandzug (6.2)", () => {
  test("addWall legt Enden der Nachbarwände im selben Befehl auf die Ecke; Undo nimmt beides zurück", () => {
    const store = open();
    const before = store.getState().project.walls.find((w) => w.id === "0aw1s0ud")!;
    store.execute(
      addWall(
        {
          id: "newwall1",
          storeyId: EG,
          kind: "interior",
          start: { x: 9000, y: 0 },
          end: { x: 9000, y: 2000 },
          thicknessMm: 100,
        },
        [{ id: "0aw1s0ud", end: "end", point: { x: 9000, y: 0 } }],
      ),
    );
    const walls = store.getState().project.walls;
    expect(walls.find((w) => w.id === "0aw1s0ud")!.end).toEqual({ x: 9000, y: 0 });
    expect(walls.find((w) => w.id === "newwall1")).toBeDefined();
    expect(store.getState().undoStack).toHaveLength(1);
    store.undo();
    expect(store.getState().project.walls.find((w) => w.id === "0aw1s0ud")).toEqual(before);
    expect(store.getState().project.walls.find((w) => w.id === "newwall1")).toBeUndefined();
  });
});

describe("Raum, Öffnung, Schräge (6.6–6.8)", () => {
  test("Raumwerte: undefined = Standard des Geschosses; Raum löschen und rückgängig", () => {
    const store = open();
    store.execute(editRoom("r3bad00a", { field: "floorBuildupMm", value: undefined }));
    expect(room(store, "r3bad00a").floorBuildupMm).toBeUndefined();
    store.execute(deleteRoom("r3bad00a"));
    expect(store.getState().project.rooms).toHaveLength(3);
    store.undo();
    store.undo();
    expect(room(store, "r3bad00a").floorBuildupMm).toBe(140);
  });

  test("ungültige Öffnungen: Warnung mit Grund, erster Grund in der Reihenfolge", () => {
    const store = open();
    const window = {
      id: "o9test01",
      storeyId: EG,
      wallId: "1aiv0ert",
      kind: "window" as const,
      offsetMm: 5500,
      widthMm: 1010,
      heightMm: 1385,
      sillMm: 900,
    };
    store.execute(addOpening(window));
    const text = () =>
      computeWarnings(store.getState().project).find((w) => w.key === "opening-invalid:o9test01")
        ?.text;
    expect(text()).toBe("Öffnung ungültig: über Wandende");
    store.execute(editOpening("o9test01", { field: "offsetMm", value: 1200 }));
    expect(text()).toBe("Öffnung ungültig: überlappt Tür bei 1000 mm");
    store.execute(editOpening("o9test01", { field: "offsetMm", value: 3000 }));
    store.execute(editOpening("o9test01", { field: "heightMm", value: 1700 }));
    expect(text()).toBe("Öffnung ungültig: höher als die Wand");
    // über Wandende und zu hoch: der erste Grund
    store.execute(editOpening("o9test01", { field: "offsetMm", value: 5500 }));
    expect(text()).toBe("Öffnung ungültig: über Wandende");
    store.execute(editOpening("o9test01", { field: "offsetMm", value: 3000 }));
    store.execute(editOpening("o9test01", { field: "heightMm", value: 1385 }));
    expect(text()).toBeUndefined();
  });

  test("ungültige Schräge erzeugt slope-invalid; Löschen und rückgängig", () => {
    const store = open();
    const through = {
      id: "sl9test1",
      baseLine: [
        { x: 150, y: 1545 },
        { x: 3940, y: 1545 },
      ] as [{ x: number; y: number }, { x: number; y: number }],
      heightAtBaseMm: 1000,
      angleDeg: 30,
    };
    store.execute(addSlope("r1kueche", through));
    const w = computeWarnings(store.getState().project).find(
      (x) => x.key === "slope-invalid:sl9test1",
    );
    expect(w).toMatchObject({
      text: "Schräge ungültig: Küche",
      target: { kind: "room", id: "r1kueche" },
    });
    store.execute(deleteSlope("r1kueche", "sl9test1"));
    expect(room(store, "r1kueche").slopes).toBeUndefined();
    store.undo();
    expect(room(store, "r1kueche").slopes).toHaveLength(1);
  });
});
