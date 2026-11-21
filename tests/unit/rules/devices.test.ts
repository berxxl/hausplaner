import { loadProject } from "../../../src/io/load";
import type { Project } from "../../../src/model/types";
import { computeWarnings, isSuppressible } from "../../../src/rules";
import { deviceWarnings, furnitureWarnings } from "../../../src/rules/devices";
import { deleteDevices, moveDevice } from "../../../src/store/devices";
import { createProjectStore } from "../../../src/store/history";
import { addFurniture } from "../../../src/store/furniture";
import { reactivateWarning, suppressWarning } from "../../../src/store/warnings";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function m2(mutate?: (p: Project) => void): Project {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return r.project;
}

const keys = (p: Project) => deviceWarnings(p).map((w) => w.key);

describe("Regeln für Geräte und Möbel (6.1)", () => {
  test("Fixture ohne Verstöße", () => {
    expect(keys(m2())).toEqual([]);
    expect(furnitureWarnings(m2())).toEqual([]);
  });

  test("Wand gekürzt, Dose außerhalb (Spec-Scenario): Gerät außerhalb der Fläche", () => {
    // Südwand 0 → 8000; Seite L zählt u ab dem Achsende, Dose Küche 1 bei u = 1200
    const p = m2((q) => {
      q.walls.find((w) => w.id === "0aw1s0ud")!.start = { x: 7000, y: 0 };
    });
    expect(deviceWarnings(p)).toEqual([
      {
        key: "device-off-surface:d1steck1",
        text: "Gerät außerhalb der Fläche: Steckdose Küche 1",
        target: { kind: "device", id: "d1steck1" },
      },
    ]);
  });

  test("Rohbauhöhe zählt: v + Fußbodenaufbau über der Wandhöhe ist außerhalb", () => {
    const p = m2((x) => {
      const d = x.devices.find((y) => y.id === "d2schalt")!;
      if (d.placement.kind === "surface") d.placement.v = 2500 - 120 + 1; // Küche: 120 mm Aufbau
    });
    expect(keys(p)).toEqual(["device-off-surface:d2schalt"]);
    if (p.devices[1]!.placement.kind === "surface") p.devices[1]!.placement.v = 2500 - 120;
    expect(keys(p)).toEqual([]);
  });

  test("Deckengerät außerhalb der Raumkontur", () => {
    const p = m2((x) => {
      const d = x.devices.find((y) => y.id === "d3decke1")!;
      if (d.placement.kind === "surface") d.placement.u = -5000; // x = 5000, außerhalb der Küche
    });
    expect(keys(p)).toEqual(["device-off-surface:d3decke1"]);
  });

  test("Verweise ins Leere (Spec-Scenario „Nicht übergehbar“): nur Löschen, nicht übergehbar", () => {
    const p = m2((x) => {
      const d = x.devices.find((y) => y.id === "d1steck1")!;
      if (d.placement.kind === "surface") d.placement.surface = "wall:zzzzzzzz:L";
      x.devices.find((y) => y.id === "d2schalt")!.typeId = "gibt-es-nicht";
      x.furniture[0]!.typeId = "sessel";
    });
    const all = computeWarnings(p);
    const surface = all.find((w) => w.key === "device-without-surface:d1steck1")!;
    expect(surface).toMatchObject({
      text: "Gerät ohne Fläche (wall:zzzzzzzz:L)",
      target: { kind: "none" },
      deletable: { kind: "device", id: "d1steck1" },
    });
    expect(all.find((w) => w.key === "device-without-type:d2schalt")).toMatchObject({
      text: "Gerät mit unbekanntem Typ (gibt-es-nicht)",
      deletable: { kind: "device", id: "d2schalt" },
    });
    expect(all.find((w) => w.key === "furniture-without-type:f1schrnk")).toMatchObject({
      text: "Möbel mit unbekanntem Typ (sessel)",
      deletable: { kind: "furniture", id: "f1schrnk" },
    });
    for (const w of all.filter((x) => x.deletable)) expect(isSuppressible(w)).toBe(false);
    expect(isSuppressible(all.find((w) => w.key.startsWith("device-covered:"))!)).toBe(true);
  });
});

describe("Übergehen und Bereinigen (6.2)", () => {
  const covered = "device-covered:d6usbsch";
  const open = (p: Project) =>
    computeWarnings(p).filter((w) => !p.suppressedWarnings.includes(w.key));

  test("Übergehen (Spec-Scenario): zählt nicht mehr als offen; Wieder aktivieren; Undo", () => {
    const store = createProjectStore(m2((p) => (p.suppressedWarnings = [])));
    expect(open(store.getState().project).map((w) => w.key)).toEqual([covered]);
    store.execute(suppressWarning(covered));
    expect(store.undoLabel()).toBe("Warnung übergehen");
    expect(store.getState().project.suppressedWarnings).toEqual([covered]);
    expect(open(store.getState().project)).toEqual([]);
    store.execute(reactivateWarning(covered));
    expect(store.undoLabel()).toBe("Warnung wieder aktivieren");
    expect(open(store.getState().project)).toHaveLength(1);
    store.undo();
    expect(store.getState().project.suppressedWarnings).toEqual([covered]);
  });

  test("Element gelöscht (Spec-Scenario) entfernt die Markierung im selben Befehl; Undo stellt sie her", () => {
    const store = createProjectStore(m2());
    store.execute(deleteDevices(["d6usbsch"]));
    expect(store.getState().project.suppressedWarnings).toEqual([]);
    store.undo();
    expect(store.getState().project.suppressedWarnings).toEqual([covered]);
    expect(store.canUndo()).toBe(false);
  });

  test("Erneut verletzt (Spec-Scenario): nach dem Beheben ist die Warnung beim nächsten Möbel wieder offen", () => {
    const store = createProjectStore(m2());
    const d = store.getState().project.devices.find((x) => x.id === "d6usbsch")!;
    if (d.placement.kind !== "surface") throw new Error();
    store.execute(moveDevice("d6usbsch", { ...d.placement, u: 7400 }));
    expect(store.getState().project.suppressedWarnings).toEqual([]);
    store.execute(
      addFurniture({
        id: "f2kommod",
        typeId: "kitchen-base",
        x: 7400,
        y: 5835 - 300,
        rotationDeg: 0,
        widthMm: 600,
        depthMm: 600,
        heightMm: 900,
        elevationMm: 0,
        storeyId: EG,
      }),
    );
    expect(open(store.getState().project).map((w) => w.key)).toEqual([covered]);
  });

  test("Befehle ohne Bezug lassen gültige Markierungen stehen; Laden bereinigt nicht", () => {
    const files = readFixture("m2");
    files["warnungen.yaml"] += '  - "room-open:gibtsnix"\n';
    const r = loadProject(files);
    if (r.status !== "ok") throw new Error();
    expect(r.project.suppressedWarnings).toEqual([covered, "room-open:gibtsnix"]);
    const store = createProjectStore(r.project);
    store.execute({ label: "Projekt umbenennen", run: (x) => void (x.name = "N") });
    expect(store.getState().project.suppressedWarnings).toEqual([covered]);
  });
});
