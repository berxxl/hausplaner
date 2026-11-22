import {
  DEFAULT_LENGTH_ALLOWANCE,
  DEFAULT_INSTALL_ZONES,
} from "../../../src/model/default-catalog";
import { createProjectStore, HISTORY_LIMIT, historyShortcut } from "../../../src/store/history";
import type { Project } from "../../../src/model/types";

function emptyProject(): Project {
  return {
    schemaVersion: 3,
    name: "Test",
    settings: {
      northDeg: 0,
      installZones: structuredClone(DEFAULT_INSTALL_ZONES),
      lengthAllowance: { ...DEFAULT_LENGTH_ALLOWANCE },
    },
    catalog: { deviceTypes: [], lineTypes: [], furnitureTypes: [] },
    devices: [],
    furniture: [],
    routeNodes: [],
    routeSegments: [],
    cables: [],
    suppressedWarnings: [],
    storeys: [],
    walls: [],
    rooms: [],
    openings: [],
  };
}

const rename = (name: string) => ({
  label: "Projekt umbenennen",
  run: (d: Project) => {
    d.name = name;
  },
});

describe("Store mit Befehlen (4.1)", () => {
  test("Undo/Redo über mehrere Befehle mit Labels", () => {
    const store = createProjectStore(emptyProject());
    store.execute(rename("A"));
    store.execute({ label: "Nordrichtung ändern", run: (d) => void (d.settings.northDeg = 90) });
    expect(store.undoLabel()).toBe("Nordrichtung ändern");
    store.undo();
    expect(store.getState().project.settings.northDeg).toBe(0);
    expect(store.getState().project.name).toBe("A");
    expect(store.redoLabel()).toBe("Nordrichtung ändern");
    store.undo();
    expect(store.getState().project.name).toBe("Test");
    expect(store.canUndo()).toBe(false);
    store.redo();
    store.redo();
    expect(store.getState().project).toMatchObject({ name: "A", settings: { northDeg: 90 } });
    expect(store.canRedo()).toBe(false);
  });

  test("neuer Befehl leert Redo; Befehl ohne Änderung erzeugt keinen Eintrag", () => {
    const store = createProjectStore(emptyProject());
    store.execute(rename("A"));
    store.undo();
    store.execute(rename("B"));
    expect(store.canRedo()).toBe(false);
    const before = store.getState().undoStack.length;
    store.execute(rename("B"));
    expect(store.getState().undoStack.length).toBe(before);
  });

  test(`Historiengrenze ${HISTORY_LIMIT} Schritte`, () => {
    const store = createProjectStore(emptyProject());
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) store.execute(rename(`N${i}`));
    expect(store.getState().undoStack).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) store.undo();
    expect(store.getState().project.name).toBe("N5");
    expect(store.canUndo()).toBe(false);
  });

  test("Ziehen ist ein Befehl, abgeschlossen beim Loslassen", () => {
    const store = createProjectStore(emptyProject());
    store.begin("Nordrichtung drehen");
    for (const deg of [10, 20, 30]) store.preview((d) => void (d.settings.northDeg = deg));
    expect(store.getState().project.settings.northDeg).toBe(30);
    expect(store.canUndo()).toBe(false);
    store.commit();
    expect(store.getState().undoStack.map((e) => e.label)).toEqual(["Nordrichtung drehen"]);
    store.undo();
    expect(store.getState().project.settings.northDeg).toBe(0);
  });

  test("abgebrochenes Ziehen stellt den Ausgangszustand her", () => {
    const store = createProjectStore(emptyProject());
    store.begin("Ziehen");
    store.preview((d) => void (d.name = "X"));
    store.cancel();
    expect(store.getState().project.name).toBe("Test");
    expect(store.canUndo()).toBe(false);
  });

  test("revision zählt Befehle, Undo und Redo; reset leert die Historie", () => {
    const store = createProjectStore(emptyProject());
    store.execute(rename("A"));
    store.undo();
    store.redo();
    expect(store.getState().revision).toBe(3);
    store.reset(emptyProject());
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
  });

  test("Kürzel", () => {
    const k = (
      key: string,
      mod: Partial<Record<"metaKey" | "ctrlKey" | "shiftKey" | "altKey", boolean>>,
    ) =>
      historyShortcut({
        key,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        ...mod,
      });
    expect(k("z", { metaKey: true })).toBe("undo");
    expect(k("z", { ctrlKey: true })).toBe("undo");
    expect(k("Z", { metaKey: true, shiftKey: true })).toBe("redo");
    expect(k("z", { ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(k("z", {})).toBeNull();
    expect(k("y", { ctrlKey: true })).toBeNull();
  });
});
