// Befehle für Verteiler (Tasks 2.2, 2.5, 3.1): Anlegen, Felder, Löschkaskaden, Einsetzen, Hierarchie
import { loadProject } from "../../../src/io/load";
import { boardNodeAnchor } from "../../../src/geometry/boards";
import type { Board, Project } from "../../../src/model/types";
import { deleteWall } from "../../../src/store/building";
import type { Checked } from "../../../src/store/catalog";
import {
  addBoard,
  assignParentBoard,
  boardCascade,
  deleteBoards,
  insertBoardDevice,
  moveBoard,
  moveBoardDevice,
  setBoardFields,
} from "../../../src/store/boards";
import { deleteStorey } from "../../../src/store/commands";
import { deleteDevices } from "../../../src/store/devices";
import { createProjectStore, type ProjectStore } from "../../../src/store/history";
import { deleteCables } from "../../../src/store/cables";
import { readFixture } from "../fixtures";

function m4(): ProjectStore {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  return createProjectStore(r.project);
}
const P = (s: ProjectStore): Project => s.getState().project;
const board = (s: ProjectStore, id: string) => P(s).boards.find((b) => b.id === id);
const ok = (r: Checked) => {
  if (!r.ok) throw new Error(r.error);
  return r.command;
};

const UV_EG = "b2uveg01";
const UV_OG = "b3uvog01";
const METER = "b1zaehl1";

describe("Verteiler anlegen, verschieben, ändern (2.2)", () => {
  test("anlegen und rückgängig", () => {
    const s = m4();
    const b: Board = {
      id: "b5neu001",
      label: "UV DG",
      kind: "sub-distribution",
      placement: { surface: "wall:1aiv0eog:L", u: 1000, v: 1500 },
      mounting: "flush",
      widthMm: 550,
      heightMm: 1100,
      depthMm: 120,
      fields: [{ id: "f9neu001", kind: "distribution", rows: 4, tePerRow: 12 }],
      storeyId: "o9g1k2m3",
    };
    s.execute(addBoard(b));
    expect(board(s, "b5neu001")).toEqual(b);
    expect(s.undoLabel()).toBe("Verteiler anlegen");
    s.undo();
    expect(board(s, "b5neu001")).toBeUndefined();
  });

  test("Felder: Feld mit Geräten nicht löschbar, Verkleinern erlaubt, Reihenfolge bleibt", () => {
    const s = m4();
    expect(setBoardFields(P(s), UV_EG, [])).toEqual({ ok: false, error: "Feld enthält 1 Gerät" });
    const fields = [
      { id: "f7oben01", kind: "upper-connection" as const, rows: 0, tePerRow: 0 },
      { id: "f4vert02", kind: "distribution" as const, rows: 1, tePerRow: 6 },
    ];
    s.execute(ok(setBoardFields(P(s), UV_EG, fields)));
    expect(board(s, UV_EG)!.fields).toEqual(fields);
    expect(setBoardFields(P(s), UV_EG, [{ ...fields[1]!, rows: -1 }]).ok).toBe(false);
  });

  test("verschieben zieht den Verteilerknoten mit (3.1)", () => {
    const s = m4();
    s.execute({
      label: "Knoten",
      run(d) {
        d.routeNodes.push({
          id: "nuveg001",
          storeyId: "e0g1k2m3",
          boardId: UV_EG,
          anchors: [{ surface: "wall:1cih0ost:R", u: 0, v: 0 }],
        });
        d.routeNodes.push({
          id: "nuveg002",
          storeyId: "e0g1k2m3",
          anchors: [{ surface: "wall:1cih0ost:R", u: 2000, v: 2200 }],
        });
        d.routeSegments.push({
          id: "suveg001",
          storeyId: "e0g1k2m3",
          a: "nuveg002",
          b: "nuveg001",
          kind: "surface",
          surface: "wall:1cih0ost:R",
          status: "planned",
        });
      },
    });
    // Normalisierung setzt den Anker auf die Mitte der Oberkante
    const node = () => P(s).routeNodes.find((n) => n.id === "nuveg001")!;
    expect(node().anchors).toEqual([{ surface: "wall:1cih0ost:R", u: 2000, v: 2050 }]);
    s.execute(moveBoard(UV_EG, { surface: "wall:1cih0ost:R", u: 2500, v: 1400 }));
    expect(node().anchors).toEqual([boardNodeAnchor(board(s, UV_EG)!)]);
    expect(node().anchors[0]).toMatchObject({ u: 2500, v: 1950 });
    // löschen: Knoten bleibt als gewöhnlicher Knoten mit seinem Segment
    s.execute(deleteBoards([UV_EG]));
    expect(node().boardId).toBeUndefined();
    expect(P(s).routeSegments.some((x) => x.id === "suveg001")).toBe(true);
  });
});

describe("Löschkaskaden (2.2)", () => {
  test("Verteiler löschen: Reiheneinbaugeräte, Stromkreise, Leitungen, Kinder, Linien; Undo stellt alles her", () => {
    const s = m4();
    const before = P(s);
    expect(boardCascade(before, [UV_OG])).toEqual({ devices: 1, circuits: 1, cables: 2 });
    s.execute(deleteBoards([UV_OG]));
    const p = P(s);
    expect(p.devices.some((d) => d.id === "d9ja0001")).toBe(false);
    expect(p.circuits.map((c) => c.id)).toEqual(["k1f1kuec"]);
    expect(p.cables.some((c) => c.id === "c4zuleit" || c.id === "c6roll01")).toBe(false);
    expect(p.devices.find((d) => d.id === "daroll01")!.circuitId).toBeUndefined();
    expect(p.devices.find((d) => d.id === "d7bodog1")!.circuitId).toBeUndefined();
    expect(p.knxAssignments).toEqual([]);
    expect(p.knxLines[0]!.boardId).toBeUndefined();
    s.undo();
    expect(P(s)).toEqual(before);
  });

  test("Kinder verlieren den übergeordneten Verteiler", () => {
    const s = m4();
    s.execute(deleteBoards([METER]));
    const og = board(s, UV_OG)!;
    expect(og.parentBoardId).toBeUndefined();
    expect(og.feedCableId).toBeUndefined();
    expect(P(s).cables.some((c) => c.id === "c4zuleit")).toBe(false);
  });

  test("Wand löschen nimmt den Verteiler mit; Geschoss löschen ebenso", () => {
    const s = m4();
    s.execute(deleteWall("1cih0ost"));
    expect(board(s, UV_EG)).toBeUndefined();
    expect(P(s).devices.some((d) => d.id === "d8lsf101")).toBe(false);
    expect(P(s).devices.find((d) => d.id === "d1steck1")!.circuitId).toBeUndefined();
    s.undo();
    s.execute(deleteStorey("o9g1k2m3"));
    expect(board(s, UV_OG)).toBeUndefined();
    expect(P(s).devices.some((d) => d.id === "d9ja0001")).toBe(false);
  });

  test("Reiheneinbaugerät löschen: Zuordnungen und Schutzgerät; Verbraucher löschen: Zuordnung", () => {
    const s = m4();
    s.execute(deleteDevices(["d8lsf101"]));
    expect(P(s).circuits.find((c) => c.id === "k1f1kuec")!.protectionDeviceId).toBeUndefined();
    s.execute(deleteDevices(["daroll01"]));
    expect(P(s).knxAssignments).toEqual([]);
  });
});

describe("Reiheneinbaugeräte einsetzen und umsetzen (2.2)", () => {
  test("einsetzen mit Prüfung, umsetzen in ein anderes Feld", () => {
    const s = m4();
    const r = insertBoardDevice(
      P(s),
      METER,
      "knx-switch-actuator-16",
      { fieldId: "f3vert01", row: 3, slot: 1 },
      "dneu0001",
    );
    s.execute(ok(r));
    const d = P(s).devices.find((x) => x.id === "dneu0001")!;
    expect(d).toMatchObject({ label: "Schaltaktor 16-fach", storeyId: "e0g1k2m3" });
    expect(s.undoLabel()).toBe("Gerät einsetzen");
    expect(
      insertBoardDevice(P(s), METER, "mcb", { fieldId: "f3vert01", row: 3, slot: 8 }, "dneu0002"),
    ).toEqual({ ok: false, error: "Kein Platz: In Reihe 3 sind ab Platz 8 nur 0 TE frei" });
    s.execute(ok(moveBoardDevice(P(s), "dneu0001", { fieldId: "f2apz001", row: 1, slot: 5 })));
    expect(P(s).devices.find((x) => x.id === "dneu0001")!.placement).toEqual({
      kind: "board",
      boardId: METER,
      fieldId: "f2apz001",
      row: 1,
      slot: 5,
    });
    expect(s.undoLabel()).toBe("Gerät umsetzen");
    expect(moveBoardDevice(P(s), "dneu0001", { fieldId: "f1zaehlr", row: 1, slot: 1 })).toEqual({
      ok: false,
      error: "Kein Platz an dieser Stelle",
    });
  });
});

describe("Verteilerhierarchie (2.5)", () => {
  test("UV OG am Zählerschrank mit NYM-J 5×10: Zuleitung als Leitung (Spec-Scenario „UV am Zählerschrank“)", () => {
    const s = m4();
    s.execute(ok(assignParentBoard(P(s), UV_OG, null, undefined, "cx000001")));
    expect(board(s, UV_OG)!.parentBoardId).toBeUndefined();
    expect(P(s).cables.some((c) => c.id === "c4zuleit")).toBe(false);
    s.execute(ok(assignParentBoard(P(s), UV_OG, METER, "nym-j-5x10", "cneu0001")));
    expect(board(s, UV_OG)).toMatchObject({ parentBoardId: METER, feedCableId: "cneu0001" });
    expect(P(s).cables.find((c) => c.id === "cneu0001")).toEqual({
      id: "cneu0001",
      label: "Zuleitung UV OG",
      lineTypeId: "nym-j-5x10",
      status: "planned",
      from: { boardId: METER },
      to: { boardId: UV_OG },
      path: [],
    });
    expect(s.undoLabel()).toBe("Verteiler zuordnen");
  });

  test("Wechsel des übergeordneten Verteilers ändert dieselbe Leitung; Zuleitung löschen entfernt feedCableId", () => {
    const s = m4();
    s.execute(ok(assignParentBoard(P(s), UV_OG, UV_EG, "nym-j-5x2-5", "cneu0001")));
    expect(board(s, UV_OG)).toMatchObject({ parentBoardId: UV_EG, feedCableId: "c4zuleit" });
    expect(P(s).cables.find((c) => c.id === "c4zuleit")).toMatchObject({
      from: { boardId: UV_EG },
      lineTypeId: "nym-j-5x2-5",
    });
    expect(P(s).cables.some((c) => c.id === "cneu0001")).toBe(false);
    s.execute(deleteCables(["c4zuleit"]));
    expect(board(s, UV_OG)!.feedCableId).toBeUndefined();
    expect(board(s, UV_OG)!.parentBoardId).toBe(UV_EG);
  });

  test("abgelehnt: Zählerschrank, Zyklus, Typ ohne Strom", () => {
    const s = m4();
    expect(assignParentBoard(P(s), METER, UV_EG, "nym-j-5x10", "x").ok).toBe(false);
    expect(assignParentBoard(P(s), METER, null, undefined, "x").ok).toBe(true);
    s.execute(ok(assignParentBoard(P(s), UV_EG, UV_OG, "nym-j-5x10", "cneu0002")));
    expect(assignParentBoard(P(s), UV_OG, UV_EG, "nym-j-5x10", "x")).toEqual({
      ok: false,
      error: "Ein Verteiler kann nicht unter sich selbst hängen",
    });
    expect(assignParentBoard(P(s), UV_EG, METER, "cat-7", "x")).toEqual({
      ok: false,
      error: "Zuleitung braucht einen Leitungstyp des Gewerks Strom",
    });
  });
});
