/**
 * Erzeugt tests/fixtures/m4 aus der M3-Fixture über Store-Befehle (normalisiert) und den Writer
 * (design.md M4 „Tests und Fixtures“). Läuft nur mit GEN_FIXTURE_M4=1:
 *   GEN_FIXTURE_M4=1 npx vitest run tests/unit/io/fixture-m4.gen.test.ts
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import type { Board, Device, Project } from "../../../src/model/types";
import { defaultCatalog, M6_DEVICE_TYPE_IDS } from "../../../src/model/default-catalog";
import { createProjectStore } from "../../../src/store/history";
import { readV3Fixture } from "../fixtures";

const OUT = join(__dirname, "..", "..", "fixtures", "m4");

export const M4_IDS = {
  meter: "b1zaehl1",
  uvEg: "b2uveg01",
  uvOg: "b3uvog01",
  media: "b4medien",
  mcb: "d8lsf101",
  blindActuator: "d9ja0001",
  shutter: "daroll01",
  network: "dbnetz01",
  circuitKitchen: "k1f1kuec",
  circuitKind: "k2f2kind",
  line: "l1linie1",
  feedOg: "c4zuleit",
} as const;

function board(
  id: string,
  label: string,
  kind: Board["kind"],
  surface: string,
  u: number,
  v: number,
  size: [number, number, number],
  mounting: Board["mounting"],
  fields: Board["fields"],
): Omit<Board, "storeyId"> {
  const [widthMm, heightMm, depthMm] = size;
  return {
    id,
    label,
    kind,
    placement: { surface, u, v },
    mounting,
    widthMm,
    heightMm,
    depthMm,
    fields,
  };
}

export function buildM4(): Project {
  const r = loadProject(readV3Fixture("m3"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  const store = createProjectStore(r.project);
  const I = M4_IDS;
  store.execute({
    label: "M4-Fixture",
    run(d) {
      // alle Standardtypen, die die M2/M3-Teilkatalog-Fixture nicht hat (eigene Typen bleiben)
      const std = defaultCatalog();
      for (const key of ["deviceTypes", "lineTypes", "furnitureTypes"] as const) {
        const have = new Set(d.catalog[key].map((t) => t.id));
        for (const t of std[key]) if (!have.has(t.id)) (d.catalog[key] as { id: string }[]).push(t);
      }
      // Klimatypen wie in M4 ohne Rolle (ab M6 abgeleitet); die M6-Typen ergänzt die Migration 4 → 5
      for (const t of d.catalog.deviceTypes)
        if (t.refrigerant && !M6_DEVICE_TYPE_IDS.includes(t.id)) delete t.refrigerant.unit;
      const eg = "e0g1k2m3";
      const og = "o9g1k2m3";
      const boards: Omit<Board, "storeyId">[] = [
        board(
          I.meter,
          "Zählerschrank",
          "meter-cabinet",
          "wall:0bw2o0st:L",
          1500,
          1400,
          [800, 1100, 210],
          "surface",
          [
            { id: "f1zaehlr", kind: "meter", rows: 0, tePerRow: 0 },
            { id: "f2apz001", kind: "apz", rows: 1, tePerRow: 12 },
            { id: "f3vert01", kind: "distribution", rows: 5, tePerRow: 12 },
          ],
        ),
        board(
          I.uvEg,
          "UV EG",
          "sub-distribution",
          "wall:1cih0ost:R",
          2000,
          1500,
          [550, 1100, 120],
          "flush",
          [{ id: "f4vert02", kind: "distribution", rows: 4, tePerRow: 12 }],
        ),
        {
          ...board(
            I.uvOg,
            "UV OG",
            "sub-distribution",
            "wall:1bih0wog:R",
            2000,
            1500,
            [550, 1100, 120],
            "flush",
            [{ id: "f5vert03", kind: "distribution", rows: 4, tePerRow: 12 }],
          ),
          parentBoardId: I.meter,
          feedCableId: I.feedOg,
        },
        board(
          I.media,
          "Medienverteiler",
          "media",
          "wall:1aiv0ert:L",
          2000,
          1500,
          [550, 650, 120],
          "flush",
          [{ id: "f6multi1", kind: "multimedia", rows: 2, tePerRow: 12 }],
        ),
      ];
      d.boards.push(...boards.map((b) => ({ ...b, storeyId: b.id === I.uvOg ? og : eg })));
      const devices: Device[] = [
        {
          id: I.mcb,
          label: "F1 LS B16",
          typeId: "mcb",
          status: "planned",
          storeyId: eg,
          placement: { kind: "board", boardId: I.uvEg, fieldId: "f4vert02", row: 1, slot: 1 },
        },
        {
          id: I.blindActuator,
          label: "JA1",
          typeId: "knx-blind-actuator",
          status: "planned",
          storeyId: og,
          placement: { kind: "board", boardId: I.uvOg, fieldId: "f5vert03", row: 1, slot: 1 },
          knxLineId: I.line,
        },
        {
          id: I.shutter,
          label: "Rollladen Kind",
          typeId: "shutter-motor",
          status: "planned",
          storeyId: og,
          placement: {
            kind: "surface",
            surface: "wall:0aw1s0og:L",
            u: 2000,
            v: 2300,
            rotationDeg: 0,
          },
          circuitId: I.circuitKind,
        },
        {
          id: I.network,
          label: "Netzwerkdose Wohnen",
          typeId: "network-socket",
          status: "planned",
          storeyId: eg,
          placement: {
            kind: "surface",
            surface: "wall:1cih0ost:R",
            u: 1000,
            v: 300,
            rotationDeg: 0,
          },
        },
      ];
      d.devices.push(...devices);
      d.devices.find((x) => x.id === "d1steck1")!.circuitId = I.circuitKitchen;
      d.devices.find((x) => x.id === "d7bodog1")!.circuitId = I.circuitKind;
      d.circuits.push(
        {
          id: I.circuitKitchen,
          label: "F1 Küche Steckdosen",
          boardId: I.uvEg,
          protectionDeviceId: I.mcb,
          lineTypeId: "nym-j-3x2-5",
        },
        { id: I.circuitKind, label: "F2 Kind", boardId: I.uvOg, lineTypeId: "nym-j-3x1-5" },
      );
      d.knxLines.push({ id: I.line, label: "1.1", boardId: I.uvOg });
      d.knxAssignments.push({
        actuatorDeviceId: I.blindActuator,
        channel: 1,
        consumerDeviceId: I.shutter,
      });
      d.cables.push(
        {
          id: I.feedOg,
          label: "Zuleitung UV OG",
          lineTypeId: "nym-j-5x10",
          status: "planned",
          from: { boardId: I.meter },
          to: { boardId: I.uvOg },
          path: [],
        },
        {
          id: "c5steck1",
          label: "Steckdose Küche 1 – UV EG",
          lineTypeId: "nym-j-3x2-5",
          status: "planned",
          from: { deviceId: "d1steck1" },
          to: { boardId: I.uvEg },
          path: [],
        },
        {
          id: "c6roll01",
          label: "Rollladen Kind – UV OG",
          lineTypeId: "nym-j-5x1-5",
          status: "planned",
          from: { deviceId: I.shutter },
          to: { boardId: I.uvOg },
          path: [],
        },
        {
          id: "c7netz01",
          label: "Netzwerkdose Wohnen – Medienverteiler",
          lineTypeId: "cat-7",
          status: "planned",
          from: { deviceId: I.network },
          to: { boardId: I.media },
          path: [],
        },
      );
    },
  });
  return store.getState().project;
}

describe.skipIf(!process.env.GEN_FIXTURE_M4)("Fixture m4 erzeugen", () => {
  test("schreibt tests/fixtures/m4", () => {
    const files = projectToFiles(buildM4());
    rmSync(OUT, { recursive: true, force: true });
    for (const [path, text] of Object.entries(files)) {
      const target = join(OUT, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
  });
});
