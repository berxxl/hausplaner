// Regeln für Trassen und Leitungen (Tasks 6.1–6.3) und Leitungsbefehle (Task 5.2)
import { loadProject } from "../../../src/io/load";
import { defaultCatalog } from "../../../src/model/default-catalog";
import type { Project, RouteNode } from "../../../src/model/types";
import { computeWarnings, isSuppressible } from "../../../src/rules";
import { editRoom } from "../../../src/store/building";
import {
  addCable,
  editCable,
  setCablePath,
  setLengthAllowance,
  suggestCablePath,
} from "../../../src/store/cables";
import { deleteCatalogType } from "../../../src/store/catalog";
import { createProjectStore } from "../../../src/store/history";
import { drawSegment, editSegments, makeNode, splitSegment } from "../../../src/store/routes";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";
const W = "wall:1bih0wst:R"; // Küche: fertige Ecken 165/3925, Decke 2365 über OKFF, obere Zone 1915–2215

function setup(mutate?: (p: Project) => void) {
  const r = loadProject(readFixture("m3"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return createProjectStore(r.project);
}

const routeKeys = (p: Project) =>
  computeWarnings(p)
    .map((w) => w.key)
    .filter((k) => /^(route-|cable-|conduit-)/.test(k));

/** Freies Segment auf W zwischen zwei neuen Knoten. */
function segment(
  store: ReturnType<typeof setup>,
  id: string,
  a: [number, number],
  b: [number, number],
) {
  const p = store.getState().project;
  const na = makeNode(p, `${id}a`.padEnd(8, "0").slice(0, 8), [{ surface: W, u: a[0], v: a[1] }]);
  const nb = makeNode(p, `${id}b`.padEnd(8, "0").slice(0, 8), [{ surface: W, u: b[0], v: b[1] }]);
  store.execute(
    drawSegment({ segment: { id, a: na.id, b: nb.id, surface: W }, newNodes: [na, nb] }),
  );
}

describe("Zonenprüfung (6.2)", () => {
  test("Fixture: Stich zum Schalter, waagerecht in der oberen Zone und Aufstieg zur Decke melden nichts (Spec-Scenario „Senkrechter Stich“)", () => {
    expect(routeKeys(setup().getState().project)).toEqual(["cable-without-path:c3ohne01"]);
  });

  test("diagonales Segment meldet „Trasse außerhalb Installationszone“ (Spec-Scenario „Diagonale Trasse“)", () => {
    const store = setup();
    segment(store, "sdiag001", [1000, 1000], [1500, 1500]);
    const w = computeWarnings(store.getState().project).find(
      (x) => x.key === "route-outside-zone:sdiag001",
    );
    expect(w?.text).toBe("Trasse außerhalb Installationszone");
    expect(w && isSuppressible(w)).toBe(true);
  });

  test("waagerecht außerhalb der Zonen meldet, in der unteren Zone nicht", () => {
    const store = setup();
    segment(store, "swaag001", [1000, 1000], [1500, 1000]);
    segment(store, "swaag002", [1000, 300], [1500, 300]);
    const keys = routeKeys(store.getState().project);
    expect(keys).toContain("route-outside-zone:swaag001");
    expect(keys).not.toContain("route-outside-zone:swaag002");
  });

  test("senkrecht in der senkrechten Zone neben der Raumecke meldet nichts, daneben schon", () => {
    const store = setup();
    segment(store, "ssenk001", [300, 500], [300, 1500]);
    segment(store, "ssenk002", [1000, 500], [1000, 1500]);
    const keys = routeKeys(store.getState().project);
    expect(keys).not.toContain("route-outside-zone:ssenk001");
    expect(keys).toContain("route-outside-zone:ssenk002");
  });

  test("Stich über einen Abzweig bleibt in Ordnung", () => {
    const store = setup();
    const p = store.getState().project;
    store.execute(
      splitSegment({
        segmentId: "s1stich1",
        node: makeNode(p, "nabzw001", [{ surface: W, u: 3500, v: 1500 }]),
        idA: "sabzwa01",
        idB: "sabzwb01",
      }),
    );
    const keys = routeKeys(store.getState().project);
    expect(keys.filter((k) => k.startsWith("route-outside-zone"))).toEqual([]);
  });

  test("Wandseite ohne Raum wird nicht geprüft", () => {
    const store = setup();
    const p = store.getState().project;
    const R = "wall:0aw1s0ud:R";
    const na: RouteNode = makeNode(p, "naussen1", [{ surface: R, u: 1000, v: 1000 }]);
    const nb: RouteNode = makeNode(p, "naussen2", [{ surface: R, u: 1500, v: 1500 }]);
    store.execute(
      drawSegment({
        segment: { id: "saussen1", a: na.id, b: nb.id, surface: R },
        newNodes: [na, nb],
      }),
    );
    expect(routeKeys(store.getState().project)).not.toContain("route-outside-zone:saussen1");
  });
});

describe("Belegung (6.1)", () => {
  const withCables = (n: number) =>
    setup((p) => {
      for (let i = 0; i < n; i++)
        p.cables.push({ ...structuredClone(p.cables[0]!), id: `cx${String(i).padStart(6, "0")}` });
    });

  test("fünf Leitungen über ein Leerrohr M20 melden „Leerrohr überfüllt“ (Spec-Scenario „Volles Leerrohr“)", () => {
    const p = withCables(4).getState().project;
    const w = computeWarnings(p).find((x) => x.key === "conduit-overfull:s3zone02");
    // 5 × π · 4² / (π · 7,05²) = 161 %
    expect(w?.text).toBe("Leerrohr überfüllt (161 %)");
  });

  test("Leerrohr M25 liefert den größeren Querschnitt (Spec-Scenario „Leerrohr belegen“)", () => {
    const store = withCables(0);
    expect(routeKeys(store.getState().project)).not.toContain("conduit-overfull:s3zone02");
    // eine Leitung in M20: 64 / 198,8 = 32 % → in Ordnung; mit zwei Leitungen 64 %
    const two = withCables(1);
    expect(routeKeys(two.getState().project)).toContain("conduit-overfull:s3zone02");
    two.execute(editSegments(["s3zone02"], { conduit: { size: "M25", innerDiameterMm: 18.3 } }));
    // 2 × 16π / (9,15² π) = 38 % ≤ 40 %
    expect(routeKeys(two.getState().project)).not.toContain("conduit-overfull:s3zone02");
  });
});

describe("Weg und Verweise (6.3)", () => {
  test("Leitung ohne Weg und Weg unterbrochen", () => {
    const store = setup((p) => (p.cables[0]!.path = ["s1stich1", "s5decke1"]));
    const ws = computeWarnings(store.getState().project);
    expect(ws.find((w) => w.key === "cable-without-path:c1licht1")?.text).toBe(
      "Weg unterbrochen: Schalter Küche – Deckenauslass",
    );
    expect(ws.find((w) => w.key === "cable-without-path:c3ohne01")?.text).toBe(
      "Leitung ohne Weg: Schalter Küche – Steckdose",
    );
  });

  test("Übergang nicht mehr auf der Kante", () => {
    const store = setup();
    store.execute(editRoom("r1kueche", { field: "rawHeightMm", value: 2600 }));
    expect(routeKeys(store.getState().project)).toContain("route-node-off-edge:n5decke1");
  });

  test("Verweise ins Leere: nicht übergehbar, mit Aktion", () => {
    const store = setup((p) => {
      p.routeNodes.find((n) => n.id === "n4zone02")!.anchors[0]!.surface = "wall:zzzzzzzz:L";
      p.routeNodes.find((n) => n.id === "n1schalt")!.deviceId = "zzzzzzz1";
      p.routeSegments.find((s) => s.id === "s2zone01")!.b = "zzzzzzz2";
      p.cables[1]!.lineTypeId = "unbekannt";
      p.cables[2]!.to = { deviceId: "zzzzzzz3" };
    });
    const ws = computeWarnings(store.getState().project);
    const get = (k: string) => ws.find((w) => w.key === k)!;
    expect(get("route-node-without-surface:n4zone02").deletable).toEqual({
      kind: "route-node",
      id: "n4zone02",
    });
    expect(get("route-node-without-device:n1schalt").detachNode).toBe("n1schalt");
    expect(get("route-segment-without-node:s2zone01").deletable).toEqual({
      kind: "route-segment",
      id: "s2zone01",
    });
    expect(get("cable-without-type:c2og0001").text).toBe("Leitung mit unbekanntem Typ (unbekannt)");
    expect(get("cable-without-device:c3ohne01").deletable).toEqual({
      kind: "cable",
      id: "c3ohne01",
    });
    for (const k of [
      "route-node-without-surface:n4zone02",
      "route-node-without-device:n1schalt",
      "route-segment-without-node:s2zone01",
      "cable-without-type:c2og0001",
      "cable-without-device:c3ohne01",
    ])
      expect(isSuppressible(get(k))).toBe(false);
  });
});

describe("Leitungsbefehle (5.2)", () => {
  function withKnx() {
    return setup((p) => {
      const cat = defaultCatalog();
      for (const id of ["knx-push-button", "shutter-motor"])
        p.catalog.deviceTypes.push(cat.deviceTypes.find((t) => t.id === id)!);
      p.catalog.lineTypes.push(cat.lineTypes.find((t) => t.id === "cat-7")!);
      p.devices.push(
        {
          id: "dpraes01",
          storeyId: EG,
          label: "Präsenzmelder Küche",
          typeId: "presence-knx",
          status: "planned",
          placement: {
            kind: "surface",
            surface: "ceiling:r1kueche",
            u: -1500,
            v: 2000,
            rotationDeg: 0,
          },
        },
        {
          id: "dtaster1",
          storeyId: EG,
          label: "KNX-Taster Küche",
          typeId: "knx-push-button",
          status: "planned",
          placement: { kind: "surface", surface: W, u: 3300, v: 1050, rotationDeg: 0 },
        },
        {
          id: "drollo01",
          storeyId: EG,
          label: "Rollladen Küche",
          typeId: "shutter-motor",
          status: "planned",
          placement: {
            kind: "surface",
            surface: "wall:0aw1s0ud:L",
            u: 6000,
            v: 2300,
            rotationDeg: 0,
          },
        },
      );
    });
  }

  test("KNX-Busleitung vom Präsenzmelder zum KNX-Taster (Spec-Scenario „Busleitung zum Präsenzmelder“)", () => {
    const store = withKnx();
    const r = addCable(store.getState().project, {
      id: "cknx0001",
      label: "Präsenzmelder Küche – KNX-Taster Küche",
      lineTypeId: "knx-bus",
      from: { deviceId: "dpraes01" },
      to: { deviceId: "dtaster1" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) store.execute(r.command);
    expect(store.getState().project.cables.find((c) => c.id === "cknx0001")).toMatchObject({
      status: "planned",
      from: { deviceId: "dpraes01" },
      to: { deviceId: "dtaster1" },
      path: [],
    });
    expect(store.undoLabel()).toBe("Leitung anlegen");
  });

  test("Cat 7 an einen Rollladenmotor wird abgelehnt (Spec-Scenario „Unpassender Typ“)", () => {
    const store = withKnx();
    const r = addCable(store.getState().project, {
      id: "ccat0001",
      label: "x",
      lineTypeId: "cat-7",
      from: { deviceId: "drollo01" },
      to: { deviceId: "d2schalt" },
    });
    expect(r).toEqual({
      ok: false,
      error: "Keine passende Leitung: Rollladen Küche schließt Strom an, Schalter Küche Strom",
    });
    const e = editCable(store.getState().project, "c1licht1", { lineTypeId: "cat-7" });
    expect(e.ok).toBe(false);
  });

  test("Leitung anlegen schlägt den Weg vor; Weg ändern ordnet; Weg vorschlagen repariert", () => {
    const store = setup();
    const p = () => store.getState().project;
    const r = addCable(p(), {
      id: "cneu0001",
      label: "x",
      lineTypeId: "nym-j-3x1-5",
      from: { deviceId: "d3decke1" },
      to: { deviceId: "d2schalt" },
    });
    if (!r.ok) throw new Error(r.error);
    store.execute(r.command);
    const c = () => p().cables.find((x) => x.id === "cneu0001")!;
    expect(c().path).toEqual(["s5decke1", "s4hoch01", "s3zone02", "s1stich1"]);
    store.execute(setCablePath(p(), "cneu0001", ["s1stich1", "s5decke1", "s3zone02", "s4hoch01"]));
    expect(c().path).toEqual(["s5decke1", "s4hoch01", "s3zone02", "s1stich1"]);
    store.execute(setCablePath(p(), "cneu0001", ["s1stich1"]));
    expect(c().path).toEqual(["s1stich1"]);
    store.execute(suggestCablePath(p(), "cneu0001"));
    expect(c().path).toHaveLength(4);
  });

  test("verwendeter Leitungstyp kann nicht gelöscht werden; Zuschläge ≥ 0", () => {
    const p = setup().getState().project;
    expect(deleteCatalogType(p, "lineTypes", "nym-j-3x1-5")).toEqual({
      ok: false,
      error: "Typ wird von 3 Leitungen verwendet",
    });
    expect(setLengthAllowance({ perDeviceMm: -1, wastePercent: 10 }).ok).toBe(false);
    expect(setLengthAllowance({ perDeviceMm: 500, wastePercent: 5 }).ok).toBe(true);
  });
});
