// Listen (Tasks 2.1–2.5): Filter, Sortierung, Anschluss im Verteiler, Einzellisten, Material
import { cableLength } from "../../../src/geometry/cables";
import { loadProject } from "../../../src/io/load";
import type { Device, Project } from "../../../src/model/types";
import { connectionText } from "../../../src/reports/connection";
import { filterRows, sortRows, type Row } from "../../../src/reports/filter";
import { combinations, materialList } from "../../../src/reports/material";
import {
  cableRows,
  cableTotals,
  cableTotalText,
  circuitRows,
  deviceRows,
  knxRows,
  knxSummary,
  penetrationRows,
} from "../../../src/reports/rows";
import { readFixture } from "../fixtures";

const EG = "e0g1k2m3";

function project(mutate?: (p: Project) => void): Project {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error("Fixture lädt nicht");
  mutate?.(r.project);
  return r.project;
}

const device = (id: string, over: Partial<Device>): Device =>
  ({
    id,
    label: id,
    typeId: "socket",
    status: "planned",
    storeyId: EG,
    placement: { kind: "surface", surface: "wall:0aw1s0ud:L", u: 1000, v: 300, rotationDeg: 0 },
    ...over,
  }) as Device;

const texts = (rows: readonly Row[], key: string) => rows.map((r) => r.cells[key]!.text);

describe("Filter und Sortierung (2.1)", () => {
  test("Status „verlegt“ lässt nur verlegte Leitungen (Spec-Scenario „Nur Verlegtes“)", () => {
    const rows = filterRows(cableRows(project()), { statuses: ["installed"] });
    expect(rows.map((r) => r.id)).toEqual(["c2og0001"]);
  });

  test("numerisch und deutsch sortiert, absteigend, leere Werte immer am Ende", () => {
    const p = project((q) => {
      q.circuits.push(
        { id: "kf10xxxx", label: "F10 Bad", boardId: "b2uveg01", lineTypeId: "nym-j-3x1-5" },
        { id: "kf02xxxx", label: "F2 Flur", boardId: "b2uveg01" },
      );
    });
    const rows = circuitRows(p).filter((r) => r.boardId === "b2uveg01");
    expect(texts(sortRows(rows, "label"), "label")).toEqual([
      "F1 Küche Steckdosen",
      "F2 Flur",
      "F10 Bad",
    ]);
    expect(texts(sortRows(rows, "label", true), "label")).toEqual([
      "F10 Bad",
      "F2 Flur",
      "F1 Küche Steckdosen",
    ]);
    // F2 Flur hat keinen Leitungstyp: steht in beiden Richtungen hinten
    expect(sortRows(rows, "lineType").at(-1)!.id).toBe("kf02xxxx");
    expect(sortRows(rows, "lineType", true).at(-1)!.id).toBe("kf02xxxx");
  });

  test("Raumfilter: Geräte ohne Raum fallen heraus, Stromkreise kennen keinen Raumfilter", () => {
    const p = project();
    const kueche = filterRows(deviceRows(p), { roomId: "r1kueche" });
    expect(kueche.map((r) => r.id).sort()).toEqual(["d2schalt", "d3decke1"]);
    expect(filterRows(circuitRows(p), { roomId: "r1kueche" })).toHaveLength(2);
  });
});

describe("Geräteliste und Anschluss im Verteiler (2.2)", () => {
  test("Steckdose „Bad EG Waschtisch“ an F7 mit LS F7 (Spec-Scenario „Steckdose im Bad“)", () => {
    const p = project((q) => {
      q.devices.push(
        device("dlsf7xxx", {
          label: "F7",
          typeId: "mcb",
          placement: { kind: "board", boardId: "b2uveg01", fieldId: "f4vert02", row: 1, slot: 3 },
        }),
      );
      q.circuits.push({
        id: "kf7badeg",
        label: "F7 Bad EG",
        boardId: "b2uveg01",
        protectionDeviceId: "dlsf7xxx",
      });
      const d = q.devices.find((x) => x.id === "d1steck1")!;
      d.label = "Bad EG Waschtisch";
      d.circuitId = "kf7badeg";
    });
    const row = deviceRows(p).find((r) => r.cells.label.text === "Bad EG Waschtisch")!;
    expect(row.cells.connection.text).toBe("UV EG · F7 Bad EG (F7)");
    expect(row.connected).toBe(true);
  });

  test("Rollladen an JA2.C zeigt Kanal und Stromkreis (Spec-Scenario „Rollladen am Aktor“)", () => {
    const p = project((q) => {
      q.devices.find((d) => d.id === "d9ja0001")!.label = "JA2";
      q.knxAssignments[0]!.channel = 3;
    });
    const text = connectionText(
      p,
      p.devices.find((d) => d.id === "daroll01")!,
    );
    expect(text).toBe("UV OG · F2 Kind; UV OG · JA2.C");
  });

  test("Netzwerkdose ohne Leitung: „nicht angeschlossen“ und Filter (Spec-Scenario „Nicht angeschlossen“)", () => {
    const withCable = deviceRows(project()).find((r) => r.id === "dbnetz01")!;
    expect(withCable.cells.connection.text).toBe("Medienverteiler · Cat 7");
    const p = project((q) => {
      q.cables = q.cables.filter((c) => c.id !== "c7netz01");
    });
    const rows = deviceRows(p);
    const row = rows.find((r) => r.id === "dbnetz01")!;
    expect(row.cells.connection.text).toBe("nicht angeschlossen");
    expect(rows.filter((r) => !r.connected).map((r) => r.id)).toContain("dbnetz01");
  });

  test("durchgeschleifter Schalter ohne Stromkreis, Reiheneinbaugeräte fehlen, Spalten", () => {
    const rows = deviceRows(project());
    const schalter = rows.find((r) => r.id === "d2schalt")!;
    expect(schalter.cells.connection.text).toBe("UV EG · ohne Stromkreis");
    expect(schalter.cells.surface.text).toMatch(/^Wand /);
    expect(schalter.cells.height.text).toBe("1050");
    expect(schalter.cells.status.text).toBe("verlegt");
    expect(rows.find((r) => r.id === "d3decke1")!.cells.surface.text).toBe("Decke");
    expect(rows.find((r) => r.id === "d5klima1")!.cells.surface.text).toBe("frei");
    expect(rows.some((r) => r.id === "d8lsf101" || r.id === "d9ja0001")).toBe(false);
    // Standardsortierung: Geschoss nach Höhenlage (EG vor OG)
    expect(rows.at(-1)!.cells.storey.text).toBe("OG");
  });
});

describe("Stromkreise und KNX-Kanäle (2.3)", () => {
  test("alle Stromkreise der UV EG nach Bezeichnung (Spec-Scenario „Liste UV EG“), Räume und Anzahl", () => {
    const p = project((q) => {
      q.circuits.push(
        { id: "kf10xxxx", label: "F10 Bad", boardId: "b2uveg01" },
        { id: "kf03xxxx", label: "F3 Wohnen", boardId: "b2uveg01" },
      );
    });
    const rows = circuitRows(p).filter((r) => r.boardId === "b2uveg01");
    expect(texts(rows, "label")).toEqual(["F1 Küche Steckdosen", "F3 Wohnen", "F10 Bad"]);
    expect(rows[0]!.cells.protection.text).toBe("F1 LS B16");
    expect(rows[0]!.cells.devices.text).toBe("1");
    // „Steckdose Küche 1“ liegt geometrisch im Abschnitt des Wohnens
    expect(rows[0]!.cells.rooms.text).toBe("Wohnen");
  });

  test("16-fach-Aktor mit 11 Zuordnungen: 11 Zuordnungen und 5 freie Kanäle (Spec-Scenario „Freie Kanäle“)", () => {
    const p = project((q) => {
      q.devices.push(
        device("dsa16xxx", {
          label: "SA1",
          typeId: "knx-switch-actuator-16",
          placement: { kind: "board", boardId: "b3uvog01", fieldId: "f5vert03", row: 2, slot: 1 },
        }),
      );
      for (let i = 1; i <= 11; i++) {
        const id = `dl${String(i).padStart(2, "0")}xxxx`;
        q.devices.push(
          device(id, {
            label: `Licht ${i}`,
            typeId: "ceiling-outlet",
            storeyId: "o9g1k2m3",
            placement: {
              kind: "surface",
              surface: "ceiling:r9kind01",
              u: -100 * i,
              v: 500,
              rotationDeg: 0,
            },
          }),
        );
        q.knxAssignments.push({ actuatorDeviceId: "dsa16xxx", channel: i, consumerDeviceId: id });
      }
    });
    const rows = knxRows(p).filter((r) => r.cells.actuator.text === "SA1");
    expect(rows).toHaveLength(16);
    expect(knxSummary(rows)).toBe("11 Zuordnungen, 5 freie Kanäle");
    expect(rows[15]!.cells.channel.text).toBe("P");
    expect(rows[15]!.cells.consumer.text).toBe("frei");
    expect(rows[0]!.cells.function.text).toBe("Schalten");
  });
});

describe("Leitungen und Durchbrüche (2.4)", () => {
  test("40 Leitungen NYM-J 3×1,5: Gesamtlänge in m (Spec-Scenario „Summe NYM-J 3×1,5“), ohne Weg gezählt", () => {
    const base = project();
    const one = cableLength(
      base,
      base.cables.find((c) => c.id === "c1licht1")!,
    )!;
    const p = project((q) => {
      const c1 = q.cables.find((c) => c.id === "c1licht1")!;
      q.cables = q.cables.filter((c) => c.lineTypeId !== "nym-j-3x1-5");
      for (let i = 0; i < 40; i++) q.cables.push({ ...c1, id: `cx${String(i).padStart(6, "0")}` });
      q.cables.push({ ...c1, id: "cohneweg", path: [] });
    });
    const total = cableTotals(p, cableRows(p)).find((t) => t.lineTypeId === "nym-j-3x1-5")!;
    expect(total.count).toBe(41);
    expect(total.withoutPath).toBe(1);
    expect(total.lengthMm).toBeCloseTo(40 * one, 6);
    expect(cableTotalText(total)).toBe(
      `NYM-J 3×1,5: 41 Leitungen, ${(Math.round((40 * one) / 100) / 10).toFixed(1).replace(".", ",")} m, 1 ohne Weg`,
    );
  });

  test("Geschossfilter über die Endpunkte; Länge ohne Weg „–“", () => {
    const p = project();
    const og = filterRows(cableRows(p), { storeyId: "o9g1k2m3" });
    expect(og.map((r) => r.id).sort()).toEqual(["c2og0001", "c4zuleit", "c6roll01"]);
    expect(cableRows(p).find((r) => r.id === "c4zuleit")!.cells.length.text).toBe("–");
  });

  test("nur Kernbohrungen mit Durchmesser und Lage (Spec-Scenario „Liste für Kernbohrer“), Wand mit Abstand und Höhe", () => {
    const rows = penetrationRows(project());
    const kern = rows.filter((r) => r.method === "core-drill");
    expect(kern).toHaveLength(1);
    expect(kern[0]!.cells.diameter.text).toBe("65");
    expect(kern[0]!.cells.position.text).toMatch(/^x -?\d+ \/ y -?\d+$/);
    expect(kern[0]!.cells.method.text).toBe("Kernbohrung");
    expect(kern[0]!.cells.cables.text).toBe("Deckenauslass Küche – Bodendose Kind");
    const bohr = rows.find((r) => r.method === "drill")!;
    expect(bohr.cells.part.text).toMatch(/^Wand .+ \(\d+ mm\)$/);
    expect(bohr.cells.position.text).toMatch(/^-?\d+ \/ -?\d+$/);
  });
});

describe("Materialliste (2.5)", () => {
  test("85 Unterputzgeräte, davon 6 in zwei Dreifachkombinationen (Spec-Scenario „Dosen zählen“)", () => {
    const p = project((q) => {
      q.devices = q.devices.filter((d) => d.placement.kind === "board");
      const at = (i: number, u: number, v = 300) =>
        device(`du${String(i).padStart(6, "0")}`, {
          placement: { kind: "surface", surface: "wall:0aw1s0ud:L", u, v, rotationDeg: 0 },
        });
      let i = 0;
      // zwei Dreifachkombinationen: waagerecht und senkrecht im 71-mm-Raster
      for (const u of [500, 571, 642]) q.devices.push(at(i++, u));
      for (const v of [300, 371, 442]) q.devices.push(at(i++, 2000, v));
      while (i < 85) q.devices.push(at(i++, 3000 + i * 300));
    });
    const sections = materialList(p, {});
    const types = sections.find((s) => s.title === "Geräte je Typ")!;
    expect(types.rows.map((r) => [r.cells.type!.text, r.cells.count!.text])).toEqual([
      ["Steckdose", "85"],
    ]);
    const boxes = sections.find((s) => s.title === "Unterputzdosen")!;
    expect(boxes.rows.map((r) => [r.cells.item!.text, r.cells.count!.text])).toEqual([
      ["Gerätedose 60 mm", "85"],
      ["Kombination 3-fach", "2"],
    ]);
  });

  test("Kombination nur im 71-mm-Raster auf derselben Fläche", () => {
    const p = project();
    const ds = [
      device("da", {
        placement: { kind: "surface", surface: "wall:x:L", u: 0, v: 300, rotationDeg: 0 },
      }),
      device("db", {
        placement: { kind: "surface", surface: "wall:x:L", u: 72, v: 301, rotationDeg: 0 },
      }),
      device("dc", {
        placement: { kind: "surface", surface: "wall:x:L", u: 150, v: 300, rotationDeg: 0 },
      }),
      device("dd", {
        placement: { kind: "surface", surface: "wall:y:L", u: 71, v: 300, rotationDeg: 0 },
      }),
    ];
    expect([...combinations(p, ds)]).toEqual([[2, 1]]);
  });

  test("Leitungen je Typ, Leerrohre je Nenngröße aus Segmenten, Reiheneinbaugeräte mit TE; Gewerkfilter", () => {
    const sections = materialList(project(), {});
    const cables = sections.find((s) => s.title === "Leitungen je Typ")!;
    expect(cables.rows.map((r) => r.cells.type!.text)).toContain("Cat 7");
    const conduit = sections.find((s) => s.title === "Leerrohre je Nenngröße")!;
    expect(conduit.rows.map((r) => r.cells.size!.text)).toEqual(["M20"]);
    expect(Number(conduit.rows[0]!.cells.length!.sort)).toBeGreaterThan(0);
    const rail = sections.find((s) => s.title === "Reiheneinbaugeräte")!;
    expect(
      rail.rows.map((r) => [r.cells.type!.text, r.cells.count!.text, r.cells.te!.text]),
    ).toEqual([
      ["Jalousieaktor", "1", "4"],
      ["LS-Schalter", "1", "1"],
    ]);
    const power = materialList(project(), { trades: ["power"] });
    expect(power.find((s) => s.title === "Leerrohre je Nenngröße")!.rows).toHaveLength(0);
    expect(
      power.find((s) => s.title === "Geräte je Typ")!.rows.map((r) => r.cells.type!.text),
    ).not.toContain("Netzwerkdose");
  });
});
