// Verteiler als Endpunkt, Stromkreise, KNX-Befehle (Tasks 3.2, 3.3, 4.2, 5.3, 5.4, 5.6)
import { loadProject } from "../../../src/io/load";
import { cableLength, formatCableLength, routedLength } from "../../../src/geometry/cables";
import { cableCircuit, circuitCables } from "../../../src/geometry/circuits";
import { channelLabel, lineParticipantCount } from "../../../src/geometry/knx";
import type { Board, Device, Project } from "../../../src/model/types";
import { makeNode } from "../../../src/store/routes";
import { addCable, addCablesToBoard } from "../../../src/store/cables";
import type { Checked } from "../../../src/store/catalog";
import { addCircuit, assignCircuit, deleteCircuit, editCircuit } from "../../../src/store/circuits";
import { createProjectStore, type ProjectStore } from "../../../src/store/history";
import {
  addKnxLine,
  adoptSuggestion,
  assignChannel,
  assignKnxLine,
  assignLineParticipants,
  autoAssignChannels,
  deleteKnxLine,
} from "../../../src/store/knx";
import { applyWallEdit, wallGeoms } from "../../../src/store/building";
import { moveParallel } from "../../../src/geometry/wall-edit";
import { readFixture } from "../fixtures";

function m4(): Project {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  return r.project;
}
const ok = (r: Checked) => {
  if (!r.ok) throw new Error(r.error);
  return r.command;
};
const P = (s: ProjectStore) => s.getState().project;
const EG = "e0g1k2m3";
const OG = "o9g1k2m3";
const W = "wall:0aw1s0ud:L"; // Südwand EG innen, u = x

function device(
  id: string,
  label: string,
  typeId: string,
  storeyId: string,
  placement: Device["placement"],
): Device {
  return { id, label, typeId, status: "planned", storeyId, placement };
}

describe("Verteiler als Endpunkt (3.2)", () => {
  test("KNX-Busleitung vom Präsenzmelder Küche zur UV EG (Spec-Scenario „Busleitung zum Präsenzmelder“)", () => {
    const p = m4();
    p.devices.push(
      device("dprae001", "Präsenzmelder Küche", "presence-knx", EG, {
        kind: "surface",
        surface: "ceiling:r1kueche",
        u: -2000,
        v: 1500,
        rotationDeg: 0,
      }),
    );
    const s = createProjectStore(p);
    s.execute(
      ok(
        addCable(P(s), {
          id: "cbus0001",
          label: "Präsenzmelder Küche – UV EG",
          lineTypeId: "knx-bus",
          from: { deviceId: "dprae001" },
          to: { boardId: "b2uveg01" },
        }),
      ),
    );
    expect(P(s).cables.find((c) => c.id === "cbus0001")).toMatchObject({
      from: { deviceId: "dprae001" },
      to: { boardId: "b2uveg01" },
      status: "planned",
    });
  });

  test("Cat 7 am Rollladenmotor abgelehnt (Spec-Scenario „Unpassender Typ“); Cat 7 an die UV abgelehnt", () => {
    const p = m4();
    const r = addCable(p, {
      id: "cx000001",
      label: "x",
      lineTypeId: "cat-7",
      from: { deviceId: "daroll01" },
      to: { boardId: "b4medien" },
    });
    expect(r).toEqual({
      ok: false,
      error:
        "Keine passende Leitung: Rollladen Kind schließt Strom an, Medienverteiler Daten, Strom, Leerrohr, Sonstiges",
    });
    expect(
      addCable(p, {
        id: "cx000002",
        label: "x",
        lineTypeId: "cat-7",
        from: { deviceId: "dbnetz01" },
        to: { boardId: "b2uveg01" },
      }).ok,
    ).toBe(false);
  });

  /** UV auf der Südwand bei u = 7800, Oberkante 2100; Trasse Dose (1200/300) → (1200/2100) → UV: 8,4 m. */
  function withRoute(): ProjectStore {
    const p = m4();
    const board: Board = {
      id: "bsued001",
      label: "UV Süd",
      kind: "sub-distribution",
      placement: { surface: W, u: 7800, v: 1550 },
      mounting: "flush",
      widthMm: 550,
      heightMm: 1100,
      depthMm: 120,
      fields: [],
      storeyId: EG,
    };
    p.boards.push(board);
    const n = (id: string, u: number, v: number) => makeNode(p, id, [{ surface: W, u, v }]);
    p.routeNodes.push(
      { ...n("nsteck01", 1200, 300), deviceId: "d1steck1" },
      n("nknick01", 1200, 2100),
      { ...n("nuvsued1", 7800, 2100), boardId: board.id },
    );
    const seg = (id: string, a: string, b: string) => ({
      id,
      storeyId: EG,
      a,
      b,
      kind: "surface" as const,
      surface: W,
      status: "planned" as const,
    });
    p.routeSegments.push(
      seg("ssued001", "nsteck01", "nknick01"),
      seg("ssued002", "nknick01", "nuvsued1"),
    );
    const s = createProjectStore(p);
    s.execute(
      ok(
        addCable(P(s), {
          id: "csued001",
          label: "Steckdose – UV Süd",
          lineTypeId: "nym-j-3x2-5",
          from: { deviceId: "d1steck1" },
          to: { boardId: board.id },
        }),
      ),
    );
    return s;
  }

  test("8,4 m Trasse Dose → Verteiler ergibt 11,2 m (Spec-Scenario „Längenberechnung“)", () => {
    const s = withRoute();
    const c = P(s).cables.find((x) => x.id === "csued001")!;
    expect(c.path).toEqual(["ssued001", "ssued002"]);
    expect(routedLength(P(s), c)).toBe(8400);
    expect(cableLength(P(s), c)).toBeCloseTo((8400 + 300 + 1500) * 1.1);
    expect(formatCableLength(cableLength(P(s), c))).toBe("11,2 m");
  });

  test("Wand verschoben: Segmente und Länge folgen (Spec-Scenario „Wand verschoben“)", () => {
    // UV an der Küchenwand zum Bad (1bih0wst:R), Oberkante 1550 bei u = 2000; Trasse zur oberen Zone
    // (n4zone02, 2000/2065), dann wie c1licht1 über die Oberkante (s4hoch01) zum Deckenauslass (s5decke1)
    const p = m4();
    const K = "wall:1bih0wst:R";
    p.boards.push({
      id: "bkueche1",
      label: "UV Küche",
      kind: "sub-distribution",
      placement: { surface: K, u: 2000, v: 1000 },
      mounting: "flush",
      widthMm: 550,
      heightMm: 1100,
      depthMm: 120,
      fields: [],
      storeyId: EG,
    });
    p.routeNodes.push({
      ...makeNode(p, "nuvkue01", [{ surface: K, u: 2000, v: 1550 }]),
      boardId: "bkueche1",
    });
    p.routeSegments.push({
      id: "suvkue01",
      storeyId: EG,
      a: "nuvkue01",
      b: "n4zone02",
      kind: "surface",
      surface: K,
      status: "planned",
    });
    const s = createProjectStore(p);
    s.execute(
      ok(
        addCable(P(s), {
          id: "ckue0001",
          label: "UV Küche – Deckenauslass",
          lineTypeId: "nym-j-3x1-5",
          from: { boardId: "bkueche1" },
          to: { deviceId: "d3decke1" },
        }),
      ),
    );
    const cab = () => P(s).cables.find((x) => x.id === "ckue0001")!;
    expect(cab().path).toEqual(["suvkue01", "s4hoch01", "s5decke1"]);
    const before = routedLength(P(s), cab())!;
    s.execute(
      applyWallEdit(EG, moveParallel(wallGeoms(P(s), EG), "1bih0wst", 200), "Wand verschieben"),
    );
    expect(routedLength(P(s), cab())).toBe(before + 200);
    expect(cableLength(P(s), cab())).toBeCloseTo((before + 200 + 1500 + 300) * 1.1);
  });
});

describe("Mehrere Leitungen gleichzeitig (3.3)", () => {
  test("alle Rollladenmotoren im OG mit NYM-J 5×1,5 zur UV OG: je Motor eine Leitung (Spec-Scenario „Alle Rollläden im OG“)", () => {
    const p = m4();
    for (let i = 1; i <= 3; i++)
      p.devices.push(
        device(`dmot000${i}`, `Rollladen ${i}`, "shutter-motor", OG, {
          kind: "surface",
          surface: "wall:0aw1s0og:L",
          u: 5000 + i * 300,
          v: 2300,
          rotationDeg: 0,
        }),
      );
    const s = createProjectStore(p);
    const motors = P(s)
      .devices.filter((d) => d.typeId === "shutter-motor" && d.storeyId === OG)
      .map((d) => d.id);
    expect(motors).toHaveLength(4);
    const r = addCablesToBoard(P(s), motors, "b3uvog01", "nym-j-5x1-5", "planned", [
      "cm000001",
      "cm000002",
      "cm000003",
      "cm000004",
    ]);
    if (!r.ok) throw new Error(r.error);
    // Rollladen Kind hat schon eine NYM-J 5×1,5 zur UV OG
    expect([r.added, r.skipped]).toEqual([3, 1]);
    s.execute(r.command);
    expect(s.undoLabel()).toBe("Leitungen anlegen");
    const created = P(s).cables.filter((c) => c.id.startsWith("cm"));
    expect(created.map((c) => c.label)).toEqual([
      "Rollladen 1 – UV OG",
      "Rollladen 2 – UV OG",
      "Rollladen 3 – UV OG",
    ]);
    expect(created.every((c) => c.to.boardId === "b3uvog01" && Array.isArray(c.path))).toBe(true);
    // erneuter Aufruf überspringt alle
    expect(addCablesToBoard(P(s), motors, "b3uvog01", "nym-j-5x1-5", "planned", ["x"])).toEqual({
      ok: false,
      error: "0 Leitungen angelegt, 4 übersprungen",
    });
  });
});

describe("Stromkreise (4.2)", () => {
  test("„F12 Küche Steckdosen“ in der UV EG mit LS B16 und NYM-J 3×2,5 (Spec-Scenario „Küchenkreis“)", () => {
    const s = createProjectStore(m4());
    s.execute(
      ok(
        addCircuit(P(s), {
          id: "kf120001",
          label: "F12 Küche Steckdosen",
          boardId: "b2uveg01",
          protectionDeviceId: "d8lsf101",
          lineTypeId: "nym-j-3x2-5",
        }),
      ),
    );
    expect(P(s).circuits.find((c) => c.id === "kf120001")).toEqual({
      id: "kf120001",
      label: "F12 Küche Steckdosen",
      boardId: "b2uveg01",
      protectionDeviceId: "d8lsf101",
      lineTypeId: "nym-j-3x2-5",
    });
    expect(
      addCircuit(P(s), {
        id: "kx000001",
        label: "F13",
        boardId: "b3uvog01",
        protectionDeviceId: "d8lsf101",
      }),
    ).toEqual({ ok: false, error: "Schutzgerät muss im selben Verteiler stehen" });
    expect(
      addCircuit(P(s), { id: "kx000002", label: "F14", boardId: "b2uveg01", lineTypeId: "cat-7" })
        .ok,
    ).toBe(false);
    s.execute(ok(editCircuit(P(s), "kf120001", { protectionDeviceId: undefined })));
    expect(P(s).circuits.find((c) => c.id === "kf120001")!.protectionDeviceId).toBeUndefined();
  });

  test("fünf Steckdosen F12 zuweisen: alle und ihre Zuleitungen gehören zu F12 (Spec-Scenario „Mehrfachzuordnung“)", () => {
    const p = m4();
    for (let i = 1; i <= 4; i++)
      p.devices.push(
        device(`dsteck0${i}`, `Steckdose ${i}`, "socket", EG, {
          kind: "surface",
          surface: W,
          u: 1500 + i * 300,
          v: 300,
          rotationDeg: 0,
        }),
      );
    // durchgeschleift: UV EG – d1steck1 (c5steck1) – dsteck01 – dsteck02 …
    for (let i = 1; i <= 4; i++)
      p.cables.push({
        id: `cdurch0${i}`,
        label: "x",
        lineTypeId: "nym-j-3x2-5",
        status: "planned",
        from: { deviceId: i === 1 ? "d1steck1" : `dsteck0${i - 1}` },
        to: { deviceId: `dsteck0${i}` },
        path: [],
      });
    const s = createProjectStore(p);
    s.execute(ok(addCircuit(P(s), { id: "kf120001", label: "F12", boardId: "b2uveg01" })));
    const five = ["d1steck1", "dsteck01", "dsteck02", "dsteck03", "dsteck04"];
    s.execute(assignCircuit(P(s), [...five, "dbnetz01", "d8lsf101"], "kf120001"));
    expect(s.undoLabel()).toBe("Stromkreis zuweisen");
    expect(
      P(s)
        .devices.filter((d) => d.circuitId === "kf120001")
        .map((d) => d.id)
        .sort(),
    ).toEqual([...five].sort());
    expect(
      circuitCables(P(s), "kf120001")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["c5steck1", "cdurch01", "cdurch02", "cdurch03", "cdurch04"]);
    expect(
      cableCircuit(
        P(s),
        P(s).cables.find((c) => c.id === "c3ohne01")!,
      ),
    ).toBeUndefined();
    s.undo();
    expect(P(s).devices.find((d) => d.id === "dsteck01")!.circuitId).toBeUndefined();
    // Stromkreis löschen löst die Geräte
    s.execute(deleteCircuit("k1f1kuec"));
    expect(P(s).devices.find((d) => d.id === "d1steck1")!.circuitId).toBeUndefined();
    expect(P(s).cables.find((c) => c.id === "c5steck1")).toBeDefined();
  });
});

describe("KNX-Befehle (5.3, 5.4, 5.6)", () => {
  function withMotors(n: number): ProjectStore {
    const p = m4();
    for (let i = 1; i <= n; i++) {
      p.devices.push(
        device(`dmot00${String(i).padStart(2, "0")}`, `Rollladen ${i}`, "shutter-motor", OG, {
          kind: "surface",
          surface: "wall:0aw1s0og:L",
          u: 4500 + i * 200,
          v: 2300,
          rotationDeg: 0,
        }),
      );
      p.cables.push({
        id: `cmot00${String(i).padStart(2, "0")}`,
        label: "x",
        lineTypeId: "nym-j-5x1-5",
        status: "planned",
        from: { deviceId: `dmot00${String(i).padStart(2, "0")}` },
        to: { boardId: "b3uvog01" },
        path: [],
      });
    }
    return createProjectStore(p);
  }

  test("Vorschlag übernehmen: Aktoren an freien Plätzen (Spec-Scenario „Übernehmen“)", () => {
    const s = withMotors(5);
    // 6 Verbraucher · 1,2 = 8 Kanäle, JA1 hat 4 → ein weiterer Jalousieaktor
    s.execute(ok(adoptSuggestion(P(s), "b3uvog01", ["dneu0001"])));
    expect(P(s).devices.find((d) => d.id === "dneu0001")).toMatchObject({
      label: "JA2",
      typeId: "knx-blind-actuator",
      storeyId: OG,
      placement: { kind: "board", boardId: "b3uvog01", fieldId: "f5vert03", row: 1, slot: 5 },
    });
    expect(s.undoLabel()).toBe("Aktorvorschlag übernehmen");
    expect(adoptSuggestion(P(s), "b3uvog01", [])).toEqual({ ok: false, error: "Kein Aktor nötig" });
  });

  test("zu wenig Platz lehnt ganz ab", () => {
    const s = withMotors(30);
    s.execute({
      label: "klein",
      run: (d) => {
        const b = d.boards.find((x) => x.id === "b3uvog01")!;
        b.fields[0] = { ...b.fields[0]!, rows: 1 };
      },
    });
    // 31 · 1,2 = 38 Kanäle, vorhanden 4 → 34 fehlen = 9 Aktoren à 4 TE; Platz: 8 TE frei
    const r = adoptSuggestion(
      P(s),
      "b3uvog01",
      Array.from({ length: 9 }, (_, i) => `dneu000${i}`),
    );
    expect(r).toEqual({ ok: false, error: "Nicht genug Platz: es fehlen 28 TE" });
  });

  test("„Rollladen Bad“ auf Jalousieaktor 2, Kanal C (Spec-Scenario „Rollladen zuordnen“)", () => {
    // 5 Verbraucher · 1,2 = 6 Kanäle, JA1 hat 4 → JA2
    const s = withMotors(4);
    s.execute(ok(adoptSuggestion(P(s), "b3uvog01", ["dja20001"])));
    s.execute({
      label: "umbenennen",
      run: (d) => void (d.devices.find((x) => x.id === "dmot0001")!.label = "Rollladen Bad"),
    });
    s.execute(ok(assignChannel(P(s), "dmot0001", { actuatorDeviceId: "dja20001", channel: 3 })));
    const a = P(s).knxAssignments.find((x) => x.consumerDeviceId === "dmot0001")!;
    const actuator = P(s).devices.find((d) => d.id === a.actuatorDeviceId)!;
    expect(`${channelLabel(actuator.label, a.channel)} → Rollladen Bad`).toBe(
      "JA2.C → Rollladen Bad",
    );
    // belegter Kanal nicht doppelt, neue Zuordnung ersetzt die alte
    expect(assignChannel(P(s), "daroll01", { actuatorDeviceId: "dja20001", channel: 3 })).toEqual({
      ok: false,
      error: "Kanal ist schon belegt",
    });
    s.execute(ok(assignChannel(P(s), "dmot0001", { actuatorDeviceId: "dja20001", channel: 4 })));
    expect(P(s).knxAssignments.filter((x) => x.consumerDeviceId === "dmot0001")).toEqual([
      { actuatorDeviceId: "dja20001", channel: 4, consumerDeviceId: "dmot0001" },
    ]);
    expect(assignChannel(P(s), "dmot0001", { actuatorDeviceId: "dja20001", channel: 9 }).ok).toBe(
      false,
    );
  });

  test("Kanäle automatisch zuordnen (Spec-Scenario „Automatisch zuordnen“)", () => {
    const s = withMotors(3);
    s.execute(ok(autoAssignChannels(P(s), "b3uvog01")));
    expect(s.undoLabel()).toBe("Kanäle automatisch zuordnen");
    expect(
      P(s)
        .knxAssignments.filter((a) => a.actuatorDeviceId === "d9ja0001")
        .map((a) => a.channel),
    ).toEqual([1, 2, 3, 4]);
    expect(autoAssignChannels(P(s), "b3uvog01").ok).toBe(false);
  });

  test("32 Teilnehmer an Linie 1.1 (Spec-Scenario „Linie zählen“); Zuordnung über Busleitungen", () => {
    const p = m4();
    for (let i = 0; i < 31; i++)
      p.devices.push(
        device(`dtast${String(i).padStart(3, "0")}`, `Taster ${i}`, "knx-push-button", OG, {
          kind: "surface",
          surface: "wall:0aw1s0og:L",
          u: 4200 + i * 50,
          v: 1050,
          rotationDeg: 0,
        }),
      );
    const s = createProjectStore(p);
    const taster = P(s)
      .devices.filter((d) => d.typeId === "knx-push-button")
      .map((d) => d.id);
    s.execute(assignKnxLine(P(s), [...taster, "daroll01"], "l1linie1"));
    expect(lineParticipantCount(P(s), "l1linie1")).toBe(32);
    // Linie 1.2 über Busleitungen: Taster mit Busleitung zur UV EG
    s.execute(addKnxLine({ id: "l2linie2", label: "1.2", boardId: "b2uveg01" }));
    s.execute(assignKnxLine(P(s), ["dtast000"], null));
    s.execute({
      label: "Bus",
      run: (d) =>
        void d.cables.push({
          id: "cbus0001",
          label: "x",
          lineTypeId: "knx-bus",
          status: "planned",
          from: { deviceId: "dtast000" },
          to: { boardId: "b2uveg01" },
          path: [],
        }),
    });
    s.execute(ok(assignLineParticipants(P(s), "l2linie2")));
    expect(P(s).devices.find((d) => d.id === "dtast000")!.knxLineId).toBe("l2linie2");
    expect(lineParticipantCount(P(s), "l2linie2")).toBe(1);
    s.execute(deleteKnxLine("l1linie1"));
    expect(P(s).devices.some((d) => d.knxLineId === "l1linie1")).toBe(false);
  });
});
