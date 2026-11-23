import {
  M4_DEVICE_TYPE_IDS,
  M6_DEVICE_TYPE_IDS,
  M4_LINE_TYPE_IDS,
} from "../../../src/model/default-catalog";
// Standardkatalog (1.5) und Migration 1 → 2 (1.6)
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import {
  DEFAULT_DEVICE_TYPES,
  DEFAULT_FURNITURE_TYPES,
  DEFAULT_LINE_TYPES,
  defaultCatalog,
} from "../../../src/model/default-catalog";
import { CatalogFileSchema } from "../../../src/model/schema";
import { createProjectStore } from "../../../src/store/history";
import { readV1Fixture } from "../fixtures";

describe("Standardkatalog (1.5)", () => {
  // Spec device-catalog „Standardkatalog“: Begriff der Spec → ID im Katalog
  const SPEC_DEVICES: Record<string, string> = {
    Steckdose: "socket",
    Doppelsteckdose: "socket-double",
    Schalter: "switch",
    "KNX-Taster": "knx-push-button",
    Präsenzmelder: "presence-knx",
    Deckenauslass: "ceiling-outlet",
    Wandauslass: "wall-outlet",
    Spot: "spot",
    Rollladenmotor: "shutter-motor",
    Netzwerkdose: "network-socket",
    "WLAN-Accesspoint": "wlan-ap",
    Router: "router",
    LS: "mcb",
    "FI/LS": "rcbo",
    RCD: "rcd",
    SPD: "spd",
    "KNX-Netzteil": "knx-power-supply",
    Schaltaktor: "knx-switch-actuator",
    Dimmaktor: "knx-dim-actuator",
    Jalousieaktor: "knx-blind-actuator",
    Heizungsaktor: "knx-heating-actuator",
    "Klima-Innengerät": "ac-indoor",
    "Klima-Außengerät": "ac-outdoor",
  };
  const SPEC_LINES: Record<string, string> = {
    "NYM-J 3×1,5": "nym-j-3x1-5",
    "NYM-J 5×1,5": "nym-j-5x1-5",
    "NYM-J 3×2,5": "nym-j-3x2-5",
    "NYM-J 5×2,5": "nym-j-5x2-5",
    "KNX-Busleitung": "knx-bus",
    "Cat 7": "cat-7",
    "Leerrohr M20": "conduit-m20",
    "Leerrohr M25": "conduit-m25",
    Kältemittelleitungspaar: "refrigerant-pair",
    Kondensatleitung: "condensate",
  };

  test.each(Object.entries(SPEC_DEVICES))("Gerätetyp %s vorhanden", (_, id) => {
    expect(DEFAULT_DEVICE_TYPES.some((t) => t.id === id)).toBe(true);
  });

  test.each(Object.entries(SPEC_LINES))("Leitungstyp %s vorhanden", (_, id) => {
    expect(DEFAULT_LINE_TYPES.some((t) => t.id === id)).toBe(true);
  });

  test("Präsenzmelder KNX: Gewerk KNX, Montage Decke, anschließbar KNX (Spec-Scenario)", () => {
    const t = DEFAULT_DEVICE_TYPES.find((x) => x.name === "Präsenzmelder KNX")!;
    expect(t.trade).toBe("knx");
    expect(t.mounting).toEqual(["ceiling"]);
    expect(t.connects).toEqual(["knx"]);
  });

  test("alle IDs eindeutig, Katalog besteht die eigene Schemaprüfung, Grundmöbel vorhanden", () => {
    const ids = [...DEFAULT_DEVICE_TYPES, ...DEFAULT_LINE_TYPES, ...DEFAULT_FURNITURE_TYPES].map(
      (t) => t.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(CatalogFileSchema.safeParse(defaultCatalog()).success).toBe(true);
    expect(DEFAULT_FURNITURE_TYPES.map((t) => t.id)).toEqual(
      expect.arrayContaining(["bed-160", "wardrobe", "kitchen-base", "kitchen-wall"]),
    );
  });

  test("Standardhöhen: Steckdose 300, Schalter 1050, Hängeschrank auf 1450", () => {
    const h = (id: string) => DEFAULT_DEVICE_TYPES.find((t) => t.id === id)!.defaultHeightMm;
    expect(h("socket")).toBe(300);
    expect(h("switch")).toBe(1050);
    expect(DEFAULT_FURNITURE_TYPES.find((t) => t.id === "kitchen-wall")!.elevationMm).toBe(1450);
  });

  test("defaultCatalog liefert eine unabhängige Kopie", () => {
    const a = defaultCatalog();
    a.deviceTypes[0]!.name = "geändert";
    expect(defaultCatalog().deviceTypes[0]!.name).not.toBe("geändert");
  });
});

describe("Migration 1 → 2 (1.6)", () => {
  test("Projekt aus M1: Standardkatalog und Zonen, nichts geschrieben bis zum ersten Befehl, Geschossdateien unverändert (Spec-Scenario)", () => {
    const files = readV1Fixture("klein");
    const result = loadProject(files);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.notice).toBe(
      "Projekt auf Version 5 aktualisiert, wird beim nächsten Speichern geschrieben",
    );
    // Laden selbst schreibt nichts: Vergleichsbasis ist der gelesene Inhalt
    expect(result.contents).toEqual(files);
    const p = result.project;
    expect(p.schemaVersion).toBe(5);
    expect(p.settings.installZones).toEqual({
      horizontalTop: [150, 450],
      horizontalBottom: [150, 450],
      verticalFromEdge: [100, 300],
    });
    expect(p.catalog).toEqual(defaultCatalog());
    // Nach dem ersten Befehl: projekt.yaml und katalog.yaml neu, Geschossdatei byteweise gleich
    const store = createProjectStore(p);
    store.execute({ label: "Projekt umbenennen", run: (d) => void (d.name = "Neu") });
    const out = projectToFiles(store.getState().project);
    expect(out["geschosse/eg.yaml"]).toBe(files["geschosse/eg.yaml"]);
    expect(out["projekt.yaml"]).toMatch(/^schemaVersion: 5\n/);
    expect(out["katalog.yaml"]).toContain('- id: "socket"');
  });

  test("vorhandene katalog.yaml bleibt bei der Migration 1 → 2 erhalten, 3 → 4 und 4 → 5 ergänzen nur die M4- und M6-Standardtypen", () => {
    const own =
      'furnitureTypes:\n  - id: "sofa"\n    name: "Sofa"\n    widthMm: 2000\n    depthMm: 900\n    heightMm: 800\n    elevationMm: 0\n';
    const files = { ...readV1Fixture("klein"), "katalog.yaml": own };
    const result = loadProject(files);
    if (result.status !== "ok") throw new Error(JSON.stringify(result));
    const { deviceTypes, lineTypes, furnitureTypes } = result.project.catalog;
    expect(deviceTypes.map((t) => t.id)).toEqual([...M4_DEVICE_TYPE_IDS, ...M6_DEVICE_TYPE_IDS]);
    expect(lineTypes.map((t) => t.id)).toEqual(M4_LINE_TYPE_IDS);
    expect(furnitureTypes).toEqual([
      { id: "sofa", name: "Sofa", widthMm: 2000, depthMm: 900, heightMm: 800, elevationMm: 0 },
    ]);
    expect(projectToFiles(result.project)["katalog.yaml"]).toContain(own.slice(16));
  });
});
