// Katalog bearbeiten (2.1): anlegen, kopieren, ändern, löschen mit Prüfungen und Undo
import { loadProject } from "../../../src/io/load";
import { ID_PATTERN } from "../../../src/model/ids";
import type { DeviceType, Project } from "../../../src/model/types";
import {
  addCatalogType,
  copyCatalogType,
  deleteCatalogType,
  updateCatalogType,
} from "../../../src/store/catalog";
import { createProjectStore } from "../../../src/store/history";
import { readFixture } from "../fixtures";

function open() {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  return createProjectStore(r.project);
}
const project = (s: ReturnType<typeof open>) => s.getState().project;
const deviceType = (p: Project, id: string) => p.catalog.deviceTypes.find((t) => t.id === id)!;

describe("Katalog bearbeiten (2.1)", () => {
  test("Kopie erhält neue zufällige ID und Namen „<Name> Kopie“; Undo entfernt sie", () => {
    const store = open();
    const result = copyCatalogType(project(store), "deviceTypes", "socket")!;
    store.execute(result.command);
    expect(result.id).toMatch(ID_PATTERN);
    const copy = deviceType(project(store), result.id);
    expect(copy.name).toBe("Steckdose Kopie");
    expect({ ...copy, id: "socket", name: "Steckdose" }).toEqual(
      deviceType(project(store), "socket"),
    );
    expect(store.getState().undoStack.at(-1)!.label).toBe("Typ kopieren");
    store.undo();
    expect(project(store).catalog.deviceTypes.some((t) => t.id === result.id)).toBe(false);
  });

  test("Typ ändern ersetzt den Typ, ein Undo-Schritt", () => {
    const store = open();
    const t: DeviceType = { ...deviceType(project(store), "switch"), defaultHeightMm: 1100 };
    const r = updateCatalogType(project(store), "deviceTypes", t);
    if (!r.ok) throw new Error(r.error);
    store.execute(r.command);
    expect(deviceType(project(store), "switch").defaultHeightMm).toBe(1100);
    store.undo();
    expect(deviceType(project(store), "switch").defaultHeightMm).toBe(1050);
  });

  test("verwendeter Typ mit 12 Geräten kann nicht gelöscht werden und nennt die Anzahl (Spec-Scenario)", () => {
    const store = open();
    const base = project(store).devices.find((d) => d.id === "d1steck1")!;
    store.execute({
      label: "Testgeräte",
      run(draft) {
        // socket ist schon zweimal verwendet (d1steck1, d4boden1); zehn weitere ergeben 12
        for (let i = 0; i < 10; i++)
          draft.devices.push({ ...base, id: `t${String(i).padStart(7, "0")}` });
      },
    });
    const r = deleteCatalogType(project(store), "deviceTypes", "socket");
    expect(r).toEqual({ ok: false, error: "Typ wird von 12 Geräten verwendet" });
  });

  test("unbenutzter Typ wird gelöscht; Möbeltyp in Verwendung wird abgelehnt", () => {
    const store = open();
    const r = deleteCatalogType(project(store), "deviceTypes", "presence-knx");
    if (!r.ok) throw new Error(r.error);
    store.execute(r.command);
    expect(project(store).catalog.deviceTypes.some((t) => t.id === "presence-knx")).toBe(false);
    expect(deleteCatalogType(project(store), "furnitureTypes", "wardrobe")).toEqual({
      ok: false,
      error: "Typ wird von 1 Möbel verwendet",
    });
    expect(deleteCatalogType(project(store), "lineTypes", "knx-bus").ok).toBe(true);
  });

  test("verwendete Montageart lässt sich nicht entfernen, unbenutzte schon; leer und namenlos abgelehnt", () => {
    const store = open();
    const socket = deviceType(project(store), "socket");
    // d4boden1 sitzt auf dem Boden
    expect(
      updateCatalogType(project(store), "deviceTypes", { ...socket, mounting: ["wall"] }),
    ).toEqual({ ok: false, error: "Montageart Boden wird von 1 Gerät verwendet" });
    const presence = deviceType(project(store), "presence-knx");
    expect(updateCatalogType(project(store), "deviceTypes", { ...presence, mounting: [] })).toEqual(
      { ok: false, error: "Mindestens eine Montageart ist nötig" },
    );
    expect(updateCatalogType(project(store), "deviceTypes", { ...presence, name: "  " })).toEqual({
      ok: false,
      error: "Name darf nicht leer sein",
    });
    expect(
      updateCatalogType(project(store), "deviceTypes", {
        ...deviceType(project(store), "switch"),
        mounting: ["wall", "ceiling"],
      }).ok,
    ).toBe(true);
  });

  test("Typ anlegen", () => {
    const store = open();
    store.execute(
      addCatalogType("furnitureTypes", {
        id: "ab12cd34",
        name: "Sideboard",
        widthMm: 1800,
        depthMm: 450,
        heightMm: 800,
        elevationMm: 0,
      }),
    );
    expect(project(store).catalog.furnitureTypes.map((t) => t.name)).toContain("Sideboard");
    expect(store.getState().undoStack.at(-1)!.label).toBe("Typ anlegen");
  });
});
