/**
 * Erzeugt tests/fixtures/m6 aus der M4-Fixture über einen Store-Befehl und den Writer
 * (design.md M6 „Tests und Fixtures“). Läuft nur mit GEN_FIXTURE_M6=1:
 *   GEN_FIXTURE_M6=1 npx vitest run tests/unit/io/fixture-m6.gen.test.ts
 */
import { current } from "immer";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadProject } from "../../../src/io/load";
import { projectToFiles } from "../../../src/io/project-files";
import type {
  Device,
  DeviceType,
  Project,
  RouteNode,
  RouteSegment,
} from "../../../src/model/types";
import { createProjectStore } from "../../../src/store/history";
import { readFixture } from "../fixtures";
import { M4_IDS } from "./fixture-m4.gen.test";

const OUT = join(__dirname, "..", "..", "fixtures", "m6");

export const M6_IDS = {
  indoor: "dkinnen1",
  outdoor: "dkausse1",
  drain: "dkablauf",
  spots: ["dsspot01", "dsspot02", "dsspot03", "dsspot04"],
  pendant: "dpendel1",
  pendantType: "pendant-4000",
  circuitLight: "k3f3lich",
  refrigerantCable: "ckkaelte",
  condensateCable: "ckkonden",
  view: "v1kueche",
  // Trassen: Innengerät → Bohrung → außen waagerecht zum Außengerät, außen senkrecht zum Ablauf
  nodeIndoor: "nkinnen1",
  nodeOutside: "nkaussen",
  nodeAlong: "nkentlan",
  nodeOutdoor: "nkausgr1",
  nodeDrain: "nkablauf",
  segPenetration: "skbohr01",
  segAlong: "skentlan",
  segToOutdoor: "skausgr1",
  segDown: "skrunter",
} as const;

const EG = "e0g1k2m3";
const IN = "wall:0bw2o0st:L"; // Ostwand innen (Schlafen)
const OUT_SIDE = "wall:0bw2o0st:R"; // Ostwand außen (Flächen ohne Raum)

const surfaceDevice = (
  id: string,
  label: string,
  typeId: string,
  surface: string,
  u: number,
  v: number,
  extra: Partial<Device> = {},
): Device => ({
  id,
  label,
  typeId,
  status: "planned",
  storeyId: EG,
  placement: { kind: "surface", surface, u, v, rotationDeg: 0 },
  ...extra,
});

const node = (id: string, surface: string, u: number, v: number, deviceId?: string): RouteNode => ({
  id,
  storeyId: EG,
  ...(deviceId ? { deviceId } : {}),
  anchors: [{ surface, u, v }],
});

const seg = (id: string, a: string, b: string, surface?: string): RouteSegment =>
  surface
    ? { id, a, b, storeyId: EG, kind: "surface", surface, status: "planned" }
    : {
        id,
        a,
        b,
        storeyId: EG,
        kind: "penetration",
        penetration: { method: "core-drill", diameterMm: 65 },
        status: "planned",
      };

export function buildM6(): Project {
  const r = loadProject(readFixture("m4"));
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  const store = createProjectStore(r.project);
  const I = M6_IDS;
  store.execute({
    label: "M6-Fixture",
    run(d) {
      const outlet = d.catalog.deviceTypes.find((t) => t.id === "ceiling-outlet")!;
      const pendant: DeviceType = {
        ...structuredClone(current(outlet)),
        id: I.pendantType,
        name: "Pendelleuchte 4000 K",
        light: { kind: "point", lumen: 1500, colorTempK: 4000 },
      };
      d.catalog.deviceTypes.push(pendant);
      // Ostwand innen: u = 0 bei y = 6000 (links aus Sicht des Raums), außen u = 0 bei y = 0
      d.devices.push(
        surfaceDevice(I.indoor, "Klima Schlafen", "ac-indoor", IN, 1500, 2100),
        surfaceDevice(I.outdoor, "Klima außen Schlafen", "ac-outdoor", OUT_SIDE, 1500, 600),
        surfaceDevice(I.drain, "Kondensatablauf Fallrohr", "condensate-drain", OUT_SIDE, 4500, 300),
        ...I.spots.map((id, i) =>
          surfaceDevice(
            id,
            `Spot Wohnen ${i + 1}`,
            "spot",
            "ceiling:r2wohnen",
            -(4900 + i * 800),
            1500,
            {
              circuitId: I.circuitLight,
            },
          ),
        ),
        surfaceDevice(I.pendant, "Pendel Schlafen", I.pendantType, "ceiling:r4schlaf", -6000, 4500),
      );
      d.circuits.push({
        id: I.circuitLight,
        label: "F3 Licht Wohnen",
        boardId: M4_IDS.uvEg,
        lineTypeId: "nym-j-3x1-5",
      });
      d.routeNodes.push(
        node(I.nodeIndoor, IN, 1500, 2100, I.indoor),
        node(I.nodeOutside, OUT_SIDE, 4500, 2080),
        node(I.nodeAlong, OUT_SIDE, 1500, 2050),
        node(I.nodeOutdoor, OUT_SIDE, 1500, 600, I.outdoor),
        node(I.nodeDrain, OUT_SIDE, 4500, 300, I.drain),
      );
      d.routeSegments.push(
        seg(I.segPenetration, I.nodeIndoor, I.nodeOutside),
        seg(I.segAlong, I.nodeOutside, I.nodeAlong, OUT_SIDE),
        seg(I.segToOutdoor, I.nodeAlong, I.nodeOutdoor, OUT_SIDE),
        seg(I.segDown, I.nodeOutside, I.nodeDrain, OUT_SIDE),
      );
      d.cables.push(
        {
          id: I.refrigerantCable,
          label: "Kältemittel Schlafen",
          lineTypeId: "refrigerant-pair",
          status: "planned",
          from: { deviceId: I.indoor },
          to: { deviceId: I.outdoor },
          path: [I.segPenetration, I.segAlong, I.segToOutdoor],
        },
        {
          id: I.condensateCable,
          label: "Kondensat Schlafen",
          lineTypeId: "condensate",
          status: "planned",
          from: { deviceId: I.indoor },
          to: { deviceId: I.drain },
          path: [I.segPenetration, I.segDown],
        },
      );
      d.cameraViews.push({
        id: I.view,
        name: "Küche vom Esstisch",
        position: { x: 3000, y: 2500, z: 1600 },
        target: { x: 1000, y: 800, z: 900 },
        upToStoreyId: EG,
      });
    },
  });
  return store.getState().project;
}

describe.skipIf(!process.env.GEN_FIXTURE_M6)("Fixture m6 erzeugen", () => {
  test("schreibt tests/fixtures/m6", () => {
    const files = projectToFiles(buildM6());
    rmSync(OUT, { recursive: true, force: true });
    for (const [path, text] of Object.entries(files)) {
      const target = join(OUT, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    }
  });
});
