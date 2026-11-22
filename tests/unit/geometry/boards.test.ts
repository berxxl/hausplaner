// Verteiler, Reserve, Stromkreise, KNX – reine Geometrie (Tasks 2.1, 2.6, 4.1, 5.1, 5.2)
import { loadProject } from "../../../src/io/load";
import {
  boardPlanRect,
  deviceTeWidth,
  findFreeSlot,
  fieldAccepts,
  fitError,
  rowItems,
} from "../../../src/geometry/boards";
import {
  cableCircuit,
  deviceRoom,
  circuitShortName,
  feedingBoards,
  nextCircuitLabel,
} from "../../../src/geometry/circuits";
import {
  autoAssignments,
  boardKnx,
  channelLabel,
  planSuggestion,
  reachableParticipants,
  suggestActuators,
} from "../../../src/geometry/knx";
import { boardReserve } from "../../../src/geometry/reserve";
import type { Board, Cable, Device, Project } from "../../../src/model/types";
import { readFixture } from "../fixtures";

function load(name: string): Project {
  const r = loadProject(readFixture(name));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  return r.project;
}

const OG = "o9g1k2m3";
const EG = "e0g1k2m3";
const type = (p: Project, id: string) => p.catalog.deviceTypes.find((t) => t.id === id)!;

let counter = 0;
const nid = (prefix: string) => `${prefix}${String(counter++).padStart(8 - prefix.length, "0")}`;

/** M3-Projekt mit leerer UV OG (4 × 12 TE, Wand Kind) und Katalog inkl. M4-Typen. */
function withUvOg(): { p: Project; board: Board } {
  const p = load("m3");
  const m4 = load("m4");
  p.catalog = m4.catalog;
  const board: Board = {
    id: "b9uvog99",
    label: "UV OG",
    kind: "sub-distribution",
    placement: { surface: "wall:1bih0wog:R", u: 2000, v: 1500 },
    mounting: "flush",
    widthMm: 550,
    heightMm: 1100,
    depthMm: 120,
    fields: [{ id: "f9vert99", kind: "distribution", rows: 4, tePerRow: 12 }],
    storeyId: OG,
  };
  p.boards.push(board);
  return { p, board };
}

function inBoard(
  p: Project,
  board: Board,
  typeId: string,
  row: number,
  slot: number,
  label = typeId,
) {
  const d: Device = {
    id: nid("x"),
    label,
    typeId,
    status: "planned",
    storeyId: board.storeyId,
    placement: { kind: "board", boardId: board.id, fieldId: board.fields[0]!.id, row, slot },
  };
  p.devices.push(d);
  return d;
}

/** Verbraucher an der Kindwand mit Stromleitung zum Verteiler. */
function consumer(p: Project, board: Board, typeId: string, label: string, u = 1000): Device {
  const d: Device = {
    id: nid("c"),
    label,
    typeId,
    status: "planned",
    storeyId: OG,
    placement: { kind: "surface", surface: "wall:0aw1s0og:L", u, v: 2300, rotationDeg: 0 },
  };
  p.devices.push(d);
  p.cables.push(cable(d.id, { boardId: board.id }));
  return d;
}

function cable(from: string, to: Cable["to"], lineTypeId = "nym-j-3x1-5"): Cable {
  return {
    id: nid("k"),
    label: "L",
    lineTypeId,
    status: "planned",
    from: { deviceId: from },
    to,
    path: [],
  };
}

describe("Belegung und Platzprüfung (2.1)", () => {
  test("8-TE-Aktor in Reihe 3 ab Platz 1 belegt die Plätze 1–8 (Spec-Scenario „Aktor einsetzen“)", () => {
    const { p, board } = withUvOg();
    const sa16 = type(p, "knx-switch-actuator-16");
    expect(deviceTeWidth(sa16)).toBe(8);
    const at = { fieldId: "f9vert99", row: 3, slot: 1 };
    expect(fitError(p, board, sa16, at)).toBeNull();
    const d = inBoard(p, board, sa16.id, 3, 1);
    expect(rowItems(p, board.id, "f9vert99", 3)).toEqual([{ deviceId: d.id, from: 1, to: 8 }]);
  });

  test("nur noch 4 TE frei: Einsetzen abgelehnt (Spec-Scenario „Kein Platz“)", () => {
    const { p, board } = withUvOg();
    inBoard(p, board, "knx-switch-actuator-16", 2, 1);
    const sa16 = type(p, "knx-switch-actuator-16");
    expect(fitError(p, board, sa16, { fieldId: "f9vert99", row: 2, slot: 9 })).toBe(
      "Kein Platz: In Reihe 2 sind ab Platz 9 nur 4 TE frei",
    );
    expect(fitError(p, board, sa16, { fieldId: "f9vert99", row: 2, slot: 3 })).toBe(
      "Kein Platz: In Reihe 2 sind ab Platz 3 nur 0 TE frei",
    );
    // beim Umsetzen zählt das Gerät selbst nicht
    const d = p.devices.at(-1)!;
    expect(fitError(p, board, sa16, { fieldId: "f9vert99", row: 2, slot: 3 }, d.id)).toBeNull();
    expect(fitError(p, board, sa16, { fieldId: "f9vert99", row: 5, slot: 1 })).toBe(
      "Kein Platz an dieser Stelle",
    );
  });

  test("Router passt ins Multimediafeld, nicht ins Verteilerfeld; Breite aus der 3D-Form", () => {
    const p = load("m4");
    const router = type(p, "router");
    expect(fieldAccepts(router, "multimedia")).toBe(true);
    expect(fieldAccepts(router, "distribution")).toBe(false);
    expect(deviceTeWidth(router)).toBe(Math.ceil(250 / 18));
    const uvEg = p.boards.find((b) => b.id === "b2uveg01")!;
    expect(fitError(p, uvEg, router, { fieldId: "f4vert02", row: 2, slot: 1 })).toBe(
      "Router passt nicht in ein Verteilerfeld",
    );
  });

  test("Platzsuche: erstes freies Stück, Feldreihenfolge, Reihen von oben", () => {
    const { p, board } = withUvOg();
    inBoard(p, board, "rcd", 1, 1);
    inBoard(p, board, "rcd", 1, 9);
    expect(findFreeSlot(p, board, 4)).toEqual({ fieldId: "f9vert99", row: 1, slot: 5 });
    expect(findFreeSlot(p, board, 6)).toEqual({ fieldId: "f9vert99", row: 2, slot: 1 });
    expect(findFreeSlot(p, board, 4, [{ fieldId: "f9vert99", row: 1, slot: 5, width: 4 }])).toEqual(
      { fieldId: "f9vert99", row: 2, slot: 1 },
    );
    expect(findFreeSlot(p, board, 13)).toBeNull();
  });

  test("Grundriss: Unterputz in die Wand, Aufputz in den Raum", () => {
    const p = load("m4");
    const uvEg = p.boards.find((b) => b.id === "b2uveg01")!;
    // Wand 1cih0ost (y = 3000, Dicke 120), Seite R zum Wohnen (y < 3000), Putz 15
    const flush = boardPlanRect(p, uvEg)!;
    expect(Math.max(...flush.map((q) => q.y))).toBeCloseTo(2940 - 15 + 120);
    const surf = boardPlanRect(p, { ...uvEg, mounting: "surface" })!;
    expect(Math.min(...surf.map((q) => q.y))).toBeCloseTo(2940 - 15 - 120);
    expect(Math.max(...surf.map((q) => q.x)) - Math.min(...surf.map((q) => q.x))).toBeCloseTo(550);
  });
});

describe("Reserve (2.1, 5.2)", () => {
  test("48 TE mit 42 belegt meldet „Reserve unter 25 %“ (Spec-Scenario „Zu wenig Reserve“)", () => {
    const { p, board } = withUvOg();
    for (let row = 1; row <= 3; row++)
      for (let slot = 1; slot <= 9; slot += 4) inBoard(p, board, "rcd", row, slot);
    // 9 × 4 = 36, dazu 6 × 1 LS
    for (let slot = 1; slot <= 6; slot++) inBoard(p, board, "mcb", 4, slot);
    expect(boardReserve(p, board)).toEqual({
      total: 48,
      used: 42,
      earmarked: 0,
      free: 6,
      low: true,
    });
    p.devices.splice(-1, 1);
    p.devices.splice(-1, 1);
    p.devices.splice(-1, 1);
    p.devices.splice(-1, 1);
    p.devices.splice(-1, 1);
    p.devices.splice(-1, 1);
    expect(boardReserve(p, board).low).toBe(false); // 12 von 48 frei = 25 %
  });

  test("Aktorbedarf 16 TE ohne eingesetzten Aktor zählt als vorgemerkt (Spec-Scenario „Aktorbedarf vor Belegung“)", () => {
    const { p, board } = withUvOg();
    // 13 Jalousie-Verbraucher · 1,2 = 15,6 → 16 Kanäle → 4 Jalousieaktoren à 4 TE
    for (let i = 0; i < 13; i++) consumer(p, board, "shutter-motor", `Rollladen ${i + 1}`);
    const r = boardReserve(p, board);
    expect(r.earmarked).toBe(16);
    expect(r.free).toBe(48 - 16);
  });

  test("Stromkreis ohne Schutzgerät merkt einen LS vor", () => {
    const { p, board } = withUvOg();
    p.circuits.push({ id: "k9kreis9", label: "F9", boardId: board.id });
    expect(boardReserve(p, board).earmarked).toBe(1);
    const ls = inBoard(p, board, "mcb", 1, 1);
    p.circuits[0]!.protectionDeviceId = ls.id;
    expect(boardReserve(p, board)).toMatchObject({ used: 1, earmarked: 0 });
  });
});

describe("Medienverteiler (2.6)", () => {
  test("drei Netzwerkdosen mit Leitung zum Medienverteiler ergeben 3 Ports (Spec-Scenario „Netzwerkdosen an Patchfeld“)", async () => {
    const { patchPorts } = await import("../../../src/geometry/boards");
    const p = load("m4");
    expect(patchPorts(p, "b4medien")).toBe(1);
    for (let i = 0; i < 2; i++) {
      const d: Device = {
        id: nid("n"),
        label: `Netzwerkdose ${i}`,
        typeId: "network-socket",
        status: "planned",
        storeyId: EG,
        placement: {
          kind: "surface",
          surface: "wall:1cih0ost:R",
          u: 1500 + i * 200,
          v: 300,
          rotationDeg: 0,
        },
      };
      p.devices.push(d);
      p.cables.push(cable(d.id, { boardId: "b4medien" }, "cat-7"));
    }
    // Stromleitung zum Medienverteiler zählt nicht
    p.cables.push(cable("d1steck1", { boardId: "b4medien" }));
    expect(patchPorts(p, "b4medien")).toBe(3);
  });
});

describe("Stromkreise (4.1)", () => {
  test("Kurzname und nächste Bezeichnung", () => {
    expect(circuitShortName("F12 Küche Steckdosen")).toBe("F12");
    expect(circuitShortName("  Herd ")).toBe("Herd");
    const p = load("m4");
    expect(nextCircuitLabel(p)).toBe("F3");
  });

  test("speisender Verteiler über durchgeschleifte Dosen; zwei Verteiler; keiner", () => {
    const p = load("m4");
    // d2schalt – d1steck1 (c3ohne01) – UV EG (c5steck1); d3decke1 – d2schalt (c1licht1)
    expect(feedingBoards(p, "d3decke1")).toEqual(["b2uveg01"]);
    expect(feedingBoards(p, "daroll01")).toEqual(["b3uvog01"]);
    expect(feedingBoards(p, "d4boden1")).toEqual([]);
    // Datenleitung zählt nicht
    expect(feedingBoards(p, "dbnetz01")).toEqual([]);
    p.cables.push(cable("d2schalt", { boardId: "b3uvog01" }));
    expect(feedingBoards({ ...p }, "d3decke1")).toEqual(["b2uveg01", "b3uvog01"]);
  });

  test("Leitungen eines Stromkreises sind abgeleitet", () => {
    const p = load("m4");
    const byId = (id: string) => p.cables.find((c) => c.id === id)!;
    expect(cableCircuit(p, byId("c5steck1"))?.label).toBe("F1 Küche Steckdosen");
    expect(cableCircuit(p, byId("c3ohne01"))).toBeUndefined(); // Schalter ohne Stromkreis
    p.devices.find((d) => d.id === "d2schalt")!.circuitId = "k1f1kuec";
    expect(cableCircuit(p, byId("c3ohne01"))?.id).toBe("k1f1kuec");
    // Verteiler passt nicht zum Stromkreis
    expect(cableCircuit(p, cable("d1steck1", { boardId: "b3uvog01" }))).toBeUndefined();
    // Datenleitung nie
    expect(cableCircuit(p, byId("c7netz01"))).toBeUndefined();
  });
});

describe("KNX (5.1, 5.2)", () => {
  test("Bedarf UV OG: 10 Schalten, 4 Dimmen, 7 Jalousie (Spec-Scenario „Bedarf UV OG“)", () => {
    const { p, board } = withUvOg();
    for (let i = 0; i < 10; i++) consumer(p, board, "ceiling-outlet", `Leuchte ${i}`);
    for (let i = 0; i < 4; i++) consumer(p, board, "spot", `Spot ${i}`);
    for (let i = 0; i < 7; i++) consumer(p, board, "shutter-motor", `Rollladen ${i}`);
    const rows = boardKnx(p, board.id);
    expect(rows.map((r) => [r.fn, r.demand])).toEqual([
      ["switch", 10],
      ["dim", 4],
      ["blind", 7],
    ]);
  });

  test("Verbraucher ohne Leitung zählt über seinen Stromkreis", () => {
    const { p, board } = withUvOg();
    p.circuits.push({ id: "k9kreis9", label: "F9", boardId: board.id });
    const d = consumer(p, board, "spot", "Spot");
    p.cables.pop();
    expect(boardKnx(p, board.id)).toEqual([]);
    d.circuitId = "k9kreis9";
    expect(boardKnx({ ...p }, board.id).map((r) => [r.fn, r.demand])).toEqual([["dim", 1]]);
  });

  test("10 Schaltkanäle, 8- und 16-fach, 20 %: ein 16-fach-Schaltaktor (Spec-Scenario „Vorschlag mit Reserve“)", () => {
    const { p, board } = withUvOg();
    for (let i = 0; i < 10; i++) consumer(p, board, "ceiling-outlet", `Leuchte ${i}`);
    const [row] = boardKnx(p, board.id);
    expect(row).toMatchObject({ fn: "switch", demand: 10, required: 12, provided: 0, missing: 12 });
    expect(row!.suggestion!.types.map((t) => t.id)).toEqual(["knx-switch-actuator-16"]);
    expect(row!.suggestion!.te).toBe(8);
  });

  test("Gleichstand nach TE und Anzahl: kleinste Typ-ID-Folge; kein Typ; vorhandene Kanäle", () => {
    const p = load("m4");
    const types = p.catalog.deviceTypes;
    // 8 Kanäle: 1 × 8-fach (4 TE) besser als 1 × 16-fach (8 TE)
    expect(suggestActuators(types, "switch", 8)!.types.map((t) => t.id)).toEqual([
      "knx-switch-actuator",
    ]);
    expect(suggestActuators(types, "binary-input", 3)).toBeNull();
    expect(suggestActuators(types, "blind", 0)).toEqual({ types: [], te: 0, channels: 0 });
    const twin = { ...types.find((t) => t.id === "knx-blind-actuator")!, id: "a-blind" };
    expect(suggestActuators([...types, twin], "blind", 4)!.types.map((t) => t.id)).toEqual([
      "a-blind",
    ]);
    // M4-Fixture: 1 Rollladen an der UV OG, JA1 liefert 4 Kanäle
    const [row] = boardKnx(p, "b3uvog01");
    expect(row).toMatchObject({ fn: "blind", demand: 1, required: 2, provided: 4, missing: 0 });
  });

  test("Vorschlag einplanen: freie Plätze, Bezeichnungen mit nächster Nummer, zu wenig Platz", () => {
    const { p, board } = withUvOg();
    inBoard(p, board, "knx-blind-actuator", 1, 1, "JA1");
    for (let i = 0; i < 9; i++) consumer(p, board, "shutter-motor", `Rollladen ${i}`);
    // 9 · 1,2 = 10,8 → 11, vorhanden 4, fehlen 7 → 2 Jalousieaktoren
    const plan = planSuggestion(p, board);
    expect(plan).toEqual({
      ok: true,
      actuators: [
        {
          typeId: "knx-blind-actuator",
          label: "JA2",
          placement: { fieldId: "f9vert99", row: 1, slot: 5 },
        },
        {
          typeId: "knx-blind-actuator",
          label: "JA3",
          placement: { fieldId: "f9vert99", row: 1, slot: 9 },
        },
      ],
    });
    board.fields[0] = { ...board.fields[0]!, rows: 1, tePerRow: 8 };
    expect(planSuggestion(p, board)).toEqual({ ok: false, missingTe: 4 });
  });

  test("Kanalbuchstaben und automatische Zuordnung nach Raum", () => {
    expect(channelLabel("JA2", 3)).toBe("JA2.C");
    expect(channelLabel("SA1", 27)).toBe("SA1.AA");
    const { p, board } = withUvOg();
    const ja = inBoard(p, board, "knx-blind-actuator", 1, 1, "JA1");
    const ja10 = inBoard(p, board, "knx-blind-actuator", 1, 5, "JA10");
    const ja2 = inBoard(p, board, "knx-blind-actuator", 1, 9, "JA2");
    // Kind (Raum der Südwand im OG) und ohne Raum (Außenseite)
    // u ab dem für den Betrachter linken Ende (Osten): u = 6000 liegt bei x = 2000 im Kind
    const a = consumer(p, board, "shutter-motor", "B Rollladen", 6000);
    const b = consumer(p, board, "shutter-motor", "A Rollladen", 6000);
    expect(deviceRoom(p, a)?.name).toBe("Kind");
    const outside = consumer(p, board, "shutter-motor", "0 Außen");
    outside.placement = {
      kind: "surface",
      surface: "wall:0aw1s0og:R",
      u: 1000,
      v: 2300,
      rotationDeg: 0,
    };
    p.knxAssignments.push({ actuatorDeviceId: ja.id, channel: 1, consumerDeviceId: "daussen1" });
    expect(autoAssignments(p, board.id)).toEqual([
      { actuatorDeviceId: ja.id, channel: 2, consumerDeviceId: b.id },
      { actuatorDeviceId: ja.id, channel: 3, consumerDeviceId: a.id },
      { actuatorDeviceId: ja.id, channel: 4, consumerDeviceId: outside.id },
    ]);
    void ja10;
    void ja2;
  });

  test("Linienteilnehmer über Busleitungen vom Startverteiler", () => {
    const p = load("m4");
    const line = p.knxLines[0]!; // 1.1, UV OG
    expect(reachableParticipants(p, line)).toEqual(["d9ja0001"]);
    const taster: Device = {
      id: "dtaster1",
      label: "Taster Kind",
      typeId: "knx-push-button",
      status: "planned",
      storeyId: OG,
      placement: { kind: "surface", surface: "wall:0aw1s0og:L", u: 500, v: 1050, rotationDeg: 0 },
    };
    const melder: Device = { ...taster, id: "dmelder1", label: "Melder", typeId: "presence-knx" };
    p.devices.push(taster, melder);
    p.cables.push(
      { ...cable("dtaster1", { boardId: "b3uvog01" }, "knx-bus") },
      { ...cable("dmelder1", { deviceId: "dtaster1" }, "knx-bus") },
    );
    expect(reachableParticipants(p, line)).toEqual(["d9ja0001", "dmelder1", "dtaster1"].sort());
    expect(reachableParticipants(p, { ...line, boardId: undefined })).toEqual([]);
  });
});
