// Trassenbefehle und Nachbearbeitung (Tasks 3.1, 3.2)
import { loadProject } from "../../../src/io/load";
import type { Project, RouteNode } from "../../../src/model/types";
import { deleteRoom, deleteWall, editRoom } from "../../../src/store/building";
import { deleteStorey } from "../../../src/store/commands";
import { deleteDevices, moveDevice } from "../../../src/store/devices";
import { createProjectStore } from "../../../src/store/history";
import {
  addPenetration,
  dependentCableCount,
  deleteRoute,
  drawSegment,
  editSegments,
  makeNode,
  moveNode,
  splitSegment,
} from "../../../src/store/routes";
import { readFixture } from "../fixtures";

const WALL = "wall:1bih0wst:R"; // Küche, Wand zum Bad, u = x, fertige Ecken 165 / 3925, Decke 2365

function setup(mutate?: (p: Project) => void) {
  const r = loadProject(readFixture("m2"));
  if (r.status !== "ok") throw new Error();
  mutate?.(r.project);
  return createProjectStore(r.project);
}

const p = (store: ReturnType<typeof setup>) => store.getState().project;
const nodeOf = (store: ReturnType<typeof setup>, id: string) =>
  p(store).routeNodes.find((n) => n.id === id);

/** Stich vom Schalter (d2schalt, u 3500, v 1050) senkrecht zur Decke: n1 oben (Übergang), n2 am Gerät. */
function drawStub(store: ReturnType<typeof setup>) {
  const proj = p(store);
  const top = makeNode(proj, "n1oben01", [
    { surface: WALL, u: 3500, v: 2365 },
    { surface: "ceiling:r1kueche", u: -3500, v: 2925 },
  ]);
  const dev = makeNode(proj, "n2schalt", [{ surface: WALL, u: 3500, v: 1050 }], "d2schalt");
  store.execute(
    drawSegment({
      segment: { id: "s1stich1", a: top.id, b: dev.id, surface: WALL },
      newNodes: [top, dev],
    }),
  );
}

describe("Trasse zeichnen und bearbeiten (3.1)", () => {
  test("Segment mit neuen Knoten; Geschoss gesetzt; Undo entfernt alles", () => {
    const store = setup();
    drawStub(store);
    expect(p(store).routeSegments).toEqual([
      {
        id: "s1stich1",
        storeyId: "e0g1k2m3",
        a: "n1oben01",
        b: "n2schalt",
        kind: "surface",
        surface: WALL,
        status: "planned",
      },
    ]);
    expect(nodeOf(store, "n2schalt")).toMatchObject({ deviceId: "d2schalt", storeyId: "e0g1k2m3" });
    expect(store.undoLabel()).toBe("Trasse zeichnen");
    store.undo();
    expect(p(store).routeNodes).toEqual([]);
    expect(p(store).routeSegments).toEqual([]);
  });

  test("Segment teilen: zwei Teile, gleiche Eigenschaften, Pfade in Wegrichtung", () => {
    const store = setup();
    drawStub(store);
    store.execute(
      editSegments(["s1stich1"], {
        status: "installed",
        conduit: { size: "M20", innerDiameterMm: 14.1 },
      }),
    );
    store.execute({
      label: "Leitung",
      run: (d) =>
        void d.cables.push({
          id: "c1leitg1",
          label: "L",
          lineTypeId: "nym-j-3x1-5",
          status: "planned",
          from: { deviceId: "d2schalt" },
          to: { deviceId: "d1steck1" },
          path: ["s1stich1"],
        }),
    });
    const mid: RouteNode = makeNode(p(store), "n3mitte1", [{ surface: WALL, u: 3500, v: 1800 }]);
    store.execute(
      splitSegment({ segmentId: "s1stich1", node: mid, idA: "s2teila1", idB: "s3teilb1" }),
    );
    const segs = p(store).routeSegments;
    expect(segs.map((s) => [s.id, s.a, s.b])).toEqual([
      ["s2teila1", "n1oben01", "n3mitte1"],
      ["s3teilb1", "n3mitte1", "n2schalt"],
    ]);
    expect(segs.every((s) => s.status === "installed" && s.conduit?.size === "M20")).toBe(true);
    // Leitung läuft vom Schalter (n2, Knoten b) nach oben: erst Teil B, dann Teil A
    expect(p(store).cables[0]!.path).toEqual(["s3teilb1", "s2teila1"]);
    expect(store.undoLabel()).toBe("Segment teilen");
  });

  test("Knoten verschieben: Übergangsanker folgen; Status mehrerer Segmente in einem Schritt", () => {
    const store = setup();
    drawStub(store);
    store.execute(moveNode("n1oben01", { surface: WALL, u: 3000, v: 2365 }));
    expect(nodeOf(store, "n1oben01")!.anchors).toEqual([
      { surface: WALL, u: 3000, v: 2365 },
      { surface: "ceiling:r1kueche", u: -3000, v: 2925 },
    ]);
    store.execute(editSegments(["s1stich1"], { status: "verified" }));
    expect(p(store).routeSegments[0]!.status).toBe("verified");
    store.execute(editSegments(["s1stich1"], { conduit: undefined }));
    expect(p(store).routeSegments[0]!.conduit).toBeUndefined();
  });

  test("Knoten löschen nimmt seine Segmente mit; verwaiste Knoten entfallen", () => {
    const store = setup();
    drawStub(store);
    store.execute(deleteRoute({ nodes: ["n1oben01"] }));
    expect(p(store).routeSegments).toEqual([]);
    expect(p(store).routeNodes).toEqual([]);
    store.undo();
    store.execute(deleteRoute({ segments: ["s1stich1"] }));
    expect(p(store).routeNodes).toEqual([]);
  });

  test("Durchbruch: zwei Knoten und ein Segment ohne Fläche", () => {
    const store = setup();
    const proj = p(store);
    const near = makeNode(proj, "n4kueche", [{ surface: WALL, u: 2000, v: 1000 }]);
    const far = makeNode(proj, "n5bad001", [{ surface: "wall:1bih0wst:L", u: 2000, v: 980 }]);
    store.execute(
      addPenetration({ id: "s4bohr01", near, far, method: "drill", diameterMm: 40, nearIsA: true }),
    );
    expect(p(store).routeSegments[0]).toMatchObject({
      kind: "penetration",
      a: "n4kueche",
      b: "n5bad001",
      penetration: { method: "drill", diameterMm: 40 },
    });
    expect(p(store).routeNodes).toHaveLength(2);
  });
});

describe("Nachbearbeitung und Löschkaskaden (3.2)", () => {
  test("Gerät verschieben zieht den Gerätknoten mit", () => {
    const store = setup();
    drawStub(store);
    store.execute(
      moveDevice("d2schalt", { kind: "surface", surface: WALL, u: 3500, v: 1200, rotationDeg: 0 }),
    );
    expect(nodeOf(store, "n2schalt")!.anchors).toEqual([{ surface: WALL, u: 3500, v: 1200 }]);
  });

  test("Gerät löschen löscht seine Leitungen und lässt den Knoten stehen; Undo stellt alles her", () => {
    const store = setup();
    drawStub(store);
    store.execute({
      label: "Leitung",
      run: (d) =>
        void d.cables.push({
          id: "c1leitg1",
          label: "L",
          lineTypeId: "nym-j-3x1-5",
          status: "planned",
          from: { deviceId: "d2schalt" },
          to: { deviceId: "d1steck1" },
          path: ["s1stich1"],
        }),
    });
    expect(dependentCableCount(p(store), ["d2schalt"])).toBe(1);
    store.execute(deleteDevices(["d2schalt"]));
    expect(p(store).cables).toEqual([]);
    expect(nodeOf(store, "n2schalt")!.deviceId).toBeUndefined();
    expect(p(store).routeSegments).toHaveLength(1);
    store.undo();
    expect(p(store).cables).toHaveLength(1);
    expect(nodeOf(store, "n2schalt")!.deviceId).toBe("d2schalt");
  });

  test("Wand löschen nimmt Knoten und Segmente mit, der Übergangsknoten verliert nur den Wandanker", () => {
    const store = setup();
    drawStub(store);
    store.execute(deleteWall("1bih0wst"));
    expect(p(store).routeSegments).toEqual([]);
    // n1 hätte noch den Deckenanker, ist aber ohne Segment verwaist
    expect(p(store).routeNodes).toEqual([]);
    store.undo();
    expect(p(store).routeNodes).toHaveLength(2);
    expect(p(store).routeSegments).toHaveLength(1);
  });

  test("Raum löschen: Deckenanker entfällt, Wandsegment bleibt", () => {
    const store = setup();
    drawStub(store);
    store.execute(deleteRoom("r1kueche"));
    // Der Raum fehlt, die Wand bleibt: Knoten oben hat nur noch den Wandanker
    expect(nodeOf(store, "n1oben01")!.anchors).toEqual([{ surface: WALL, u: 3500, v: 2365 }]);
    expect(p(store).routeSegments).toHaveLength(1);
  });

  test("Geschoss löschen löscht alle Trassen darin", () => {
    const store = setup();
    drawStub(store);
    store.execute(deleteStorey("e0g1k2m3"));
    expect(p(store).routeNodes).toEqual([]);
    expect(p(store).routeSegments).toEqual([]);
  });

  test("Kante entfällt: Übergangsanker bleiben stehen", () => {
    const store = setup();
    drawStub(store);
    store.execute(editRoom("r1kueche", { field: "rawHeightMm", value: 2600 }));
    // Decke 100 mm höher: der Knoten liegt nicht mehr an der Oberkante, Anker bleiben unverändert
    expect(nodeOf(store, "n1oben01")!.anchors).toHaveLength(2);
    expect(nodeOf(store, "n1oben01")!.anchors[1]).toEqual({
      surface: "ceiling:r1kueche",
      u: -3500,
      v: 2925,
    });
  });

  test("Pfade verlieren gelöschte Segmente", () => {
    const store = setup();
    drawStub(store);
    store.execute({
      label: "Leitung",
      run: (d) =>
        void d.cables.push({
          id: "c1leitg1",
          label: "L",
          lineTypeId: "nym-j-3x1-5",
          status: "planned",
          from: { deviceId: "d2schalt" },
          to: { deviceId: "d1steck1" },
          path: ["s1stich1"],
        }),
    });
    store.execute(deleteRoute({ segments: ["s1stich1"] }));
    expect(p(store).cables[0]!.path).toEqual([]);
  });
});
