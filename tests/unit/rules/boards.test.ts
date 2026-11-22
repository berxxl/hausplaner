// Warnungen M4 (Tasks 2.5, 4.3, 5.5, 6.1): Verteiler, Stromkreise, KNX, Verweise ins Leere
import { loadProject } from "../../../src/io/load";
import type { Device, Project } from "../../../src/model/types";
import { computeWarnings, isSuppressible } from "../../../src/rules";
import { readFixture } from "../fixtures";

function m4(mutate?: (p: Project) => void): Project {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  mutate?.(r.project);
  return r.project;
}
const keys = (p: Project, prefix: string) =>
  computeWarnings(p)
    .filter((w) => w.key.startsWith(prefix))
    .map((w) => w.key);
const warning = (p: Project, key: string) => computeWarnings(p).find((w) => w.key === key);

describe("Verteiler (2.5, 6.1)", () => {
  test("ohne Zuleitung: alle Verteiler außer dem Zählerschrank, nur mit Zählerschrank im Projekt", () => {
    expect(keys(m4(), "board-without-parent")).toEqual([
      "board-without-parent:b2uveg01",
      "board-without-parent:b4medien",
    ]);
    expect(warning(m4(), "board-without-parent:b2uveg01")).toMatchObject({
      text: "Verteiler ohne Zuleitung: UV EG",
      target: { kind: "board", id: "b2uveg01" },
    });
    expect(
      keys(
        m4((p) => (p.boards = p.boards.filter((b) => b.kind !== "meter-cabinet"))),
        "board-without-parent",
      ),
    ).toEqual([]);
  });

  test("Reserve unter 25 % mit Klickziel Belegung", () => {
    const p = m4((p) => {
      const b = p.boards.find((x) => x.id === "b2uveg01")!;
      b.fields[0] = { ...b.fields[0]!, rows: 1, tePerRow: 4 };
      p.devices.push({
        id: "dfi00001",
        label: "FI",
        typeId: "rcd",
        status: "planned",
        storeyId: b.storeyId,
        placement: { kind: "board", boardId: b.id, fieldId: b.fields[0]!.id, row: 1, slot: 1 },
      });
      p.devices = p.devices.filter((d) => d.id !== "d8lsf101");
    });
    const w = warning(p, "board-reserve-low:b2uveg01")!;
    // 4 TE: FI belegt 4, F1 ohne Schutzgerät merkt 1 LS vor, Deckenauslass Küche 1 Schaltaktor (4 TE)
    expect(w.text).toBe("Reserve unter 25 %: -5 von 4 TE frei");
    expect(w.target).toEqual({ kind: "board", id: "b2uveg01", open: true });
    expect(isSuppressible(w)).toBe(true);
  });

  test("Reiheneinbaugerät außerhalb der Reihe und überlappend", () => {
    const p = m4((p) => {
      const ls = p.devices.find((d) => d.id === "d8lsf101")!;
      if (ls.placement.kind === "board") ls.placement.slot = 12;
      const ja = p.devices.find((d) => d.id === "d9ja0001")!;
      p.devices.push({ ...ja, id: "d0ja0000", label: "JA0" });
      if (ja.placement.kind === "board") ja.placement.slot = 3;
      const b = p.boards.find((x) => x.id === "b2uveg01")!;
      b.fields[0] = { ...b.fields[0]!, tePerRow: 11 };
    });
    expect(keys(p, "board-device-outside")).toEqual(["board-device-outside:d8lsf101"]);
    expect(keys(p, "board-device-overlap")).toEqual(["board-device-overlap:d9ja0001"]);
    expect(warning(p, "board-device-overlap:d9ja0001")).toMatchObject({
      text: "Reiheneinbaugeräte überlappen: JA1",
      target: { kind: "board-device", id: "d9ja0001" },
    });
  });

  test("Verweise ins Leere sind nicht übergehbar und haben eine Aktion", () => {
    const p = m4((p) => {
      p.boards.find((b) => b.id === "b4medien")!.placement.surface = "wall:zzzzzzz1:L";
      const ls = p.devices.find((d) => d.id === "d8lsf101")!;
      if (ls.placement.kind === "board") ls.placement.fieldId = "zzzzzzz2";
      p.circuits.find((c) => c.id === "k2f2kind")!.boardId = "zzzzzzz3";
      p.routeNodes[0]!.boardId = "zzzzzzz4";
      p.cables.find((c) => c.id === "c7netz01")!.to = { boardId: "zzzzzzz5" };
    });
    const all = computeWarnings(p);
    const pick = (k: string) => all.find((w) => w.key === k)!;
    expect(pick("board-without-surface:b4medien")).toMatchObject({
      text: "Verteiler ohne Fläche (wall:zzzzzzz1:L)",
      deletable: { kind: "board", id: "b4medien" },
    });
    expect(pick("board-device-without-board:d8lsf101").deletable).toEqual({
      kind: "device",
      id: "d8lsf101",
    });
    expect(pick("circuit-without-board:k2f2kind")).toMatchObject({
      text: "Stromkreis an unbekanntem Verteiler: F2 Kind",
      deletable: { kind: "circuit", id: "k2f2kind" },
    });
    expect(pick(`route-node-without-board:${p.routeNodes[0]!.id}`).detachBoardNode).toBe(
      p.routeNodes[0]!.id,
    );
    expect(pick("cable-without-device:c7netz01").text).toBe(
      "Leitung an unbekanntem Gerät oder Verteiler",
    );
    for (const k of [
      "board-without-surface:b4medien",
      "board-device-without-board:d8lsf101",
      "circuit-without-board:k2f2kind",
    ])
      expect(isSuppressible(pick(k))).toBe(false);
  });
});

describe("Stromkreise (4.3)", () => {
  test("Steckdose ohne Stromkreis erscheint in der Übersicht (Spec-Scenario „Vergessene Dose“)", () => {
    const p = m4();
    const w = warning(p, "device-without-circuit:d4boden1")!;
    expect(w).toMatchObject({
      text: "Kein Stromkreis: Bodendose Wohnen",
      target: { kind: "device", id: "d4boden1" },
    });
    expect(isSuppressible(w)).toBe(true);
    // Reiheneinbaugeräte, Datengeräte und Geräte mit Stromkreis melden nicht
    const all = keys(p, "device-without-circuit");
    for (const id of ["d8lsf101", "d9ja0001", "dbnetz01", "d1steck1", "daroll01"])
      expect(all).not.toContain(`device-without-circuit:${id}`);
  });

  test("ohne Stromkreise im Projekt keine Meldung", () => {
    expect(
      keys(
        m4((p) => (p.circuits = [])),
        "device-without-circuit",
      ),
    ).toEqual([]);
  });

  test("Leitung zu einem anderen Verteiler meldet (Spec-Scenario „Verteiler passt nicht“)", () => {
    const p = m4((p) => {
      p.cables.find((c) => c.id === "c5steck1")!.to = { boardId: "b3uvog01" };
    });
    expect(warning(p, "circuit-board-mismatch:d1steck1")!.text).toBe(
      "F1 liegt in UV EG, Leitung führt zu UV OG",
    );
    // in der Fixture hängt die Bodendose Kind (F2, UV OG) am Deckenauslass Küche (UV EG)
    expect(keys(m4(), "circuit-board-mismatch")).toEqual(["circuit-board-mismatch:d7bodog1"]);
  });
});

describe("KNX (5.5)", () => {
  const motor = (i: number): Device => ({
    id: `dmot000${i}`,
    label: `Rollladen ${i}`,
    typeId: "shutter-motor",
    status: "planned",
    storeyId: "o9g1k2m3",
    placement: {
      kind: "surface",
      surface: "wall:0aw1s0og:L",
      u: 5000 + i * 100,
      v: 2300,
      rotationDeg: 0,
    },
    circuitId: "k2f2kind",
  });

  test("mehr Jalousie-Verbraucher als Kanäle: die überzähligen werden gemeldet (Spec-Scenario „Zu wenig Kanäle“)", () => {
    const p = m4((p) => {
      for (let i = 1; i <= 4; i++) p.devices.push(motor(i));
      // JA1 hat 4 Kanäle; A ist belegt, B–D werden vergeben
      for (let ch = 2; ch <= 4; ch++)
        p.knxAssignments.push({
          actuatorDeviceId: "d9ja0001",
          channel: ch,
          consumerDeviceId: `dmot000${ch - 1}`,
        });
    });
    expect(keys(p, "knx-without-channel:dmot")).toEqual(["knx-without-channel:dmot0004"]);
    expect(warning(p, "knx-without-channel:dmot0004")!.text).toBe("Kein KNX-Kanal: Rollladen 4");
  });

  test("Aktor in anderem Verteiler oder falscher Funktion meldet „passt nicht“", () => {
    const p = m4((p) => {
      const ja = p.devices.find((d) => d.id === "d9ja0001")!;
      if (ja.placement.kind === "board")
        ja.placement = { ...ja.placement, boardId: "b2uveg01", fieldId: "f4vert02", row: 2 };
    });
    expect(keys(p, "knx-channel-mismatch")).toEqual(["knx-channel-mismatch:daroll01"]);
    const q = m4(
      (p) => (p.devices.find((d) => d.id === "d9ja0001")!.typeId = "knx-switch-actuator"),
    );
    expect(keys(q, "knx-channel-mismatch")).toEqual(["knx-channel-mismatch:daroll01"]);
    expect(keys(m4(), "knx-")).toEqual(["knx-without-channel:d3decke1"]);
  });
});
