import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "zustand";
import {
  roomPolygons,
  visibleStoreys,
  wallSolids,
  type PlanarPolygon,
  type WallSolid,
} from "../../geometry/model3d";
import { sortedStoreys } from "../../io/project-files";
import type { Device, Furniture, Project } from "../../model/types";
import { deviceWorld } from "../../geometry/devices";
import { boardWorld } from "../../geometry/boards";
import type { Board } from "../../model/types";
import { segmentWorldEnds } from "../../geometry/routes";
import { furnitureBaseZ } from "../../geometry/furniture";
import { STATUS_COLORS, WARNING_COLOR } from "../labels";
import { warnedIds } from "../derived";
import { HIGHLIGHT_COLOR } from "../surface/routeGeometry";
import { isCableVisible, isDeviceVisible } from "../filter";
import type { ProjectStore } from "../../store/history";
import type { Selection, ViewStore } from "../../store/view";

/** Szene in Metern; Grundriss (x, y) und Höhe z → three (x, z, −y). */
const M = 0.001;
const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x * M, z * M, -y * M);

function wallGeometry(w: WallSolid, elevationMm: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(w.sMin, 0);
  shape.lineTo(w.sMax, 0);
  for (const p of [...w.top].reverse()) shape.lineTo(p.s, p.z);
  shape.closePath();
  for (const h of w.holes) {
    const hole = new THREE.Path();
    hole.moveTo(h.s1, h.z1);
    hole.lineTo(h.s1, h.z2);
    hole.lineTo(h.s2, h.z2);
    hole.lineTo(h.s2, h.z1);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w.thicknessMm, bevelEnabled: false });
  // lokal: x = s, y = Höhe, z = quer zur Wand (0 … Dicke) → Welt
  const origin = {
    x: w.start.x - (w.normal.x * w.thicknessMm) / 2,
    y: w.start.y - (w.normal.y * w.thicknessMm) / 2,
  };
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(w.dir.x * M, 0, -w.dir.y * M),
    new THREE.Vector3(0, M, 0),
    new THREE.Vector3(w.normal.x * M, 0, -w.normal.y * M),
  );
  m.setPosition(toThree(origin.x, origin.y, elevationMm));
  geo.applyMatrix4(m);
  geo.computeVertexNormals();
  return geo;
}

function polygonGeometry(poly: PlanarPolygon, elevationMm: number): THREE.BufferGeometry {
  const contour = poly.outline.map((p) => new THREE.Vector2(p.x, p.y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions: number[] = [];
  for (const p of poly.outline) {
    const v = toThree(p.x, p.y, elevationMm + poly.z(p));
    positions.push(v.x, v.y, v.z);
  }
  // Böden zeigen nach oben, Decken und Schrägen nach unten (von oben durchsichtig)
  const up = poly.kind === "floor";
  const index: number[] = [];
  for (const tri of tris) {
    const [a, b, c] = tri as [number, number, number];
    const pa = poly.outline[a]!;
    const pb = poly.outline[b]!;
    const pc = poly.outline[c]!;
    const ccw = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x) > 0;
    // CCW im Grundriss (y nach oben) ergibt in three (z = −y) eine nach oben zeigende Fläche
    if (ccw === up) index.push(a, b, c);
    else index.push(a, c, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

interface SceneDevice {
  device: Device;
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  /** Mittelpunkt auf der Oberfläche in Welt-mm (z global) für Tests */
  at: { x: number; y: number; z: number };
}

interface SceneFurniture {
  furniture: Furniture;
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  /** Mitte der Unterseite in Welt-mm (z global) für Tests */
  at: { x: number; y: number; z: number };
}

interface SceneBoard {
  board: Board;
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  at: { x: number; y: number; z: number };
}

/** Verteiler als Quader: Unterputz in der Wand, Aufputz vor der Wand (design.md M4). */
function boardMesh(project: Project, board: Board, elevationMm: number): SceneBoard | null {
  const w = boardWorld(project, board);
  if (!w) return null;
  const geometry = new THREE.BoxGeometry(board.widthMm * M, board.heightMm * M, board.depthMm * M);
  const zAxis = new THREE.Vector3(w.normal.x, 0, -w.normal.y).normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  const sign = board.mounting === "flush" ? -1 : 1;
  const center = toThree(w.x, w.y, w.z + elevationMm).add(
    zAxis.clone().multiplyScalar((sign * board.depthMm * M) / 2),
  );
  const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(center);
  return { board, geometry, matrix, at: { x: w.x, y: w.y, z: w.z + elevationMm } };
}

interface SceneData {
  boards: SceneBoard[];
  walls: { solid: WallSolid; geometry: THREE.BufferGeometry }[];
  polys: { poly: PlanarPolygon; geometry: THREE.BufferGeometry }[];
  devices: SceneDevice[];
  furniture: SceneFurniture[];
  routes: SceneRoute[];
  bounds: THREE.Box3;
}

/** 3D-Form eines Geräts: Rückseite auf der Oberfläche, Tiefe entlang der Normalen (design.md M2). */
function deviceMesh(project: Project, device: Device, elevationMm: number): SceneDevice | null {
  const w = deviceWorld(project, device);
  if (!w) return null;
  const type = project.catalog.deviceTypes.find((t) => t.id === device.typeId);
  const shape = type?.shape3d ?? { kind: "box", widthMm: 80, heightMm: 80, depthMm: 20 };
  const geometry =
    shape.kind === "cylinder"
      ? new THREE.CylinderGeometry(
          shape.widthMm * M * 0.5,
          shape.widthMm * M * 0.5,
          shape.depthMm * M,
          24,
        ).rotateX(Math.PI / 2)
      : new THREE.BoxGeometry(shape.widthMm * M, shape.heightMm * M, shape.depthMm * M);
  // Basis: z = Normale, y = oben (Wand: global oben, Decke/Boden: Welt +y), x = y × z
  const zAxis = new THREE.Vector3(w.normal.x, w.normal.z, -w.normal.y).normalize();
  const up = Math.abs(zAxis.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const center = toThree(w.x, w.y, w.z + elevationMm).add(
    zAxis.clone().multiplyScalar((shape.depthMm * M) / 2),
  );
  const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(center);
  return { device, geometry, matrix, at: { x: w.x, y: w.y, z: w.z + elevationMm } };
}

/** Möbel als Quader: Unterseite auf OKFF + Höhe über OKFF, gedreht um die Senkrechte. */
function furnitureMesh(project: Project, f: Furniture, elevationMm: number): SceneFurniture {
  const geometry = new THREE.BoxGeometry(f.widthMm * M, f.heightMm * M, f.depthMm * M);
  const z = furnitureBaseZ(project, f) + elevationMm;
  const matrix = new THREE.Matrix4()
    .makeRotationY((f.rotationDeg * Math.PI) / 180)
    .setPosition(toThree(f.x, f.y, z + f.heightMm / 2));
  return { furniture: f, geometry, matrix, at: { x: f.x, y: f.y, z } };
}

interface SceneRoute {
  id: string;
  status: Device["status"];
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
}

/** Segment als dünner Zylinder (Ø 20 mm), Durchbruch mit seinem Durchmesser (design.md M3 „Darstellung“). */
function routeMesh(
  project: Project,
  segment: Project["routeSegments"][number],
  nodes: ReadonlyMap<string, Project["routeNodes"][number]>,
): SceneRoute | null {
  const ends = segmentWorldEnds(project, segment, nodes);
  if (!ends) return null;
  const p = toThree(ends.a.x, ends.a.y, ends.za);
  const q = toThree(ends.b.x, ends.b.y, ends.zb);
  const dir = new THREE.Vector3().subVectors(q, p);
  const len = Math.max(dir.length(), 0.001);
  const r = ((segment.penetration?.diameterMm ?? 20) / 2) * M;
  const geometry = new THREE.CylinderGeometry(r, r, len, 12);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  const matrix = new THREE.Matrix4().compose(
    p.clone().add(dir.multiplyScalar(0.5)),
    quat,
    new THREE.Vector3(1, 1, 1),
  );
  return { id: segment.id, status: segment.status, geometry, matrix };
}

function buildScene(project: Project, upTo: string | null): SceneData {
  const walls: SceneData["walls"] = [];
  const polys: SceneData["polys"] = [];
  const devices: SceneDevice[] = [];
  const furniture: SceneFurniture[] = [];
  const routes: SceneRoute[] = [];
  const boards: SceneBoard[] = [];
  const nodes = new Map(project.routeNodes.map((n) => [n.id, n]));
  const bounds = new THREE.Box3();
  for (const storey of visibleStoreys(project, upTo)) {
    for (const solid of wallSolids(project, storey.id)) {
      const geometry = wallGeometry(solid, storey.elevationMm);
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox!);
      walls.push({ solid, geometry });
    }
    for (const room of project.rooms.filter((r) => r.storeyId === storey.id)) {
      for (const poly of roomPolygons(room, storey))
        polys.push({ poly, geometry: polygonGeometry(poly, storey.elevationMm) });
    }
    for (const device of project.devices.filter((d) => d.storeyId === storey.id)) {
      const mesh = deviceMesh(project, device, storey.elevationMm);
      if (mesh) devices.push(mesh);
    }
    for (const f of project.furniture.filter((x) => x.storeyId === storey.id))
      furniture.push(furnitureMesh(project, f, storey.elevationMm));
    for (const b of project.boards.filter((x) => x.storeyId === storey.id)) {
      const mesh = boardMesh(project, b, storey.elevationMm);
      if (mesh) boards.push(mesh);
    }
    for (const seg of project.routeSegments.filter((x) => x.storeyId === storey.id)) {
      const mesh = routeMesh(project, seg, nodes);
      if (mesh) routes.push(mesh);
    }
  }
  return { boards, walls, polys, devices, furniture, routes, bounds };
}

/** Testhilfe: Projektion eines Weltpunkts (mm) auf Seitenkoordinaten. */
function ProjectionHook({ container }: { container: HTMLElement | null }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const w = window as unknown as {
      __hausplaner3d?: { project(x: number, y: number, z: number): { x: number; y: number } };
    };
    w.__hausplaner3d = {
      project(x, y, z) {
        const v = toThree(x, y, z).project(camera);
        const r = container?.getBoundingClientRect() ?? { left: 0, top: 0 };
        return {
          x: r.left + ((v.x + 1) / 2) * size.width,
          y: r.top + ((1 - v.y) / 2) * size.height,
        };
      },
    };
    return () => {
      delete w.__hausplaner3d;
    };
  }, [camera, size, container]);
  return null;
}

function CameraFit({ bounds }: { bounds: THREE.Box3 }) {
  const { camera, invalidate } = useThree();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || bounds.isEmpty()) return;
    const c = bounds.getCenter(new THREE.Vector3());
    const r = bounds.getSize(new THREE.Vector3()).length();
    camera.position.set(c.x - r * 0.6, c.y + r * 0.8, c.z + r * 0.9);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
    invalidate();
    done.current = true;
  }, [bounds, camera, invalidate]);
  return null;
}

const COLORS = {
  wall: "#c7c7cc",
  floor: "#d9c9a8",
  ceiling: "#f2f2f7",
  slope: "#e5d7c2",
  furniture: "#b08458",
  board: "#9e9e9e",
  selected: "#0071e3",
};

/** 3D-Ansicht des Gebäudes in Rohbaumaßen; Klick wählt Wand bzw. Raum. */
export function ModelView({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const selection = useStore(view, (s) => s.selection);
  const [upTo, setUpTo] = useState<string | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const scene = useMemo(() => buildScene(project, upTo), [project, upTo]);
  const hiddenTrades = useStore(view, (s) => s.hiddenTrades);
  const furnitureHidden = useStore(view, (s) => s.furnitureHidden);
  // Gewerkfilter: das Gebäude bleibt immer sichtbar
  const devices = scene.devices.filter((d) =>
    isDeviceVisible(project, { hiddenTrades, furnitureHidden }, d.device),
  );
  const furniture = furnitureHidden ? [] : scene.furniture;
  const routesHidden = useStore(view, (s) => s.routesHidden);
  const pathEdit = useStore(view, (s) => s.pathEdit);
  const routes = routesHidden ? [] : scene.routes;
  // Hervorgehobene Leitung (design.md M3 „Leitungen“)
  const selectedCable =
    selection?.kind === "cable" ? project.cables.find((c) => c.id === selection.id) : undefined;
  const highlighted = new Set(
    pathEdit
      ? pathEdit.segmentIds
      : selectedCable && isCableVisible(project, { hiddenTrades, furnitureHidden }, selectedCable)
        ? selectedCable.path
        : [],
  );
  useEffect(
    () => () => {
      scene.walls.forEach((w) => w.geometry.dispose());
      scene.devices.forEach((d) => d.geometry.dispose());
      scene.furniture.forEach((f) => f.geometry.dispose());
      scene.routes.forEach((r) => r.geometry.dispose());
      scene.boards.forEach((b) => b.geometry.dispose());
    },
    [scene],
  );

  const isSel = (s: Selection | null, kind: Selection["kind"], id: string) =>
    s?.kind === kind && (s.id === id || !!s.ids?.includes(id));
  const pick = (sel: Selection) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    view.select(sel);
  };
  const center = scene.bounds.isEmpty()
    ? new THREE.Vector3()
    : scene.bounds.getCenter(new THREE.Vector3());
  const summary = scene.walls
    .map(({ solid: w }) => `${w.wallId}:${Math.round(w.start.x)},${Math.round(w.start.y)}`)
    .sort()
    .join(";");
  const deviceSummary = devices
    .map(
      ({ device, at }) =>
        `${device.id}:${Math.round(at.x)},${Math.round(at.y)},${Math.round(at.z)}`,
    )
    .sort()
    .join(";");
  const furnitureSummary = furniture
    .map(
      ({ furniture: f, at }) =>
        `${f.id}:${Math.round(at.x)},${Math.round(at.y)},${Math.round(at.z)}`,
    )
    .sort()
    .join(";");
  const warned = warnedIds(project);

  return (
    <div className="model3d">
      <div className="plan__toolbar">
        <label>
          Anzeigen bis{" "}
          <select
            aria-label="bis Geschoss"
            value={upTo ?? ""}
            onChange={(e) => setUpTo(e.target.value || null)}
          >
            <option value="">alle Geschosse</option>
            {sortedStoreys(project).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span className="hint">
          Ziehen dreht, rechte Maustaste schwenkt, Mausrad zoomt. Klick wählt aus.
        </span>
      </div>
      <div
        ref={setContainer}
        className="model3d__canvas"
        data-testid="scene"
        data-walls={summary}
        data-devices={deviceSummary}
        data-furniture={furnitureSummary}
        data-boards={scene.boards
          .map(
            ({ board, at }) =>
              `${board.id}:${Math.round(at.x)},${Math.round(at.y)},${Math.round(at.z)}`,
          )
          .sort()
          .join(";")}
        data-routes={routes.length}
        data-highlighted={routes
          .filter((r) => highlighted.has(r.id))
          .map((r) => r.id)
          .sort()
          .join(",")}
        data-storeys={visibleStoreys(project, upTo)
          .map((s) => s.name)
          .sort()
          .join(",")}
      >
        <Canvas
          // nur bei Änderungen rendern: eine Dauerschleife blockiert ohne GPU den Hauptthread
          frameloop="demand"
          camera={{ fov: 45, near: 0.05, far: 2000 }}
          onPointerMissed={() => view.select(null)}
        >
          <color attach="background" args={["#f5f5f7"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 8]} intensity={1.1} />
          <directionalLight position={[-12, 8, -6]} intensity={0.4} />
          {scene.walls.map(({ solid, geometry }) => (
            <mesh
              key={`${solid.storeyId}:${solid.wallId}`}
              geometry={geometry}
              onClick={pick({ kind: "wall", id: solid.wallId })}
            >
              <meshStandardMaterial
                color={isSel(selection, "wall", solid.wallId) ? COLORS.selected : COLORS.wall}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          {scene.polys.map(({ poly, geometry }, i) => (
            <mesh
              key={`${poly.roomId}:${poly.kind}:${i}`}
              geometry={geometry}
              onClick={pick({ kind: "room", id: poly.roomId })}
            >
              <meshStandardMaterial
                color={isSel(selection, "room", poly.roomId) ? COLORS.selected : COLORS[poly.kind]}
                side={THREE.FrontSide}
              />
            </mesh>
          ))}
          {devices.map(({ device, geometry, matrix }) => (
            <mesh
              key={device.id}
              geometry={geometry}
              matrix={matrix}
              matrixAutoUpdate={false}
              onClick={pick({ kind: "device", id: device.id })}
            >
              <meshStandardMaterial
                color={
                  isSel(selection, "device", device.id)
                    ? COLORS.selected
                    : warned.has(device.id)
                      ? WARNING_COLOR
                      : STATUS_COLORS[device.status]
                }
              />
            </mesh>
          ))}
          {scene.boards.map(({ board, geometry, matrix }) => (
            <mesh
              key={board.id}
              geometry={geometry}
              matrix={matrix}
              matrixAutoUpdate={false}
              onClick={pick({ kind: "board", id: board.id })}
            >
              <meshStandardMaterial
                color={isSel(selection, "board", board.id) ? COLORS.selected : COLORS.board}
              />
            </mesh>
          ))}
          {furniture.map(({ furniture: f, geometry, matrix }) => (
            <mesh
              key={f.id}
              geometry={geometry}
              matrix={matrix}
              matrixAutoUpdate={false}
              onClick={pick({ kind: "furniture", id: f.id })}
            >
              <meshStandardMaterial
                color={isSel(selection, "furniture", f.id) ? COLORS.selected : COLORS.furniture}
                transparent
                opacity={0.75}
              />
            </mesh>
          ))}
          {routes.map((r) => (
            <mesh
              key={r.id}
              geometry={r.geometry}
              matrix={r.matrix}
              matrixAutoUpdate={false}
              onClick={pick({ kind: "route-segment", id: r.id })}
            >
              <meshStandardMaterial
                color={
                  highlighted.has(r.id)
                    ? HIGHLIGHT_COLOR
                    : isSel(selection, "route-segment", r.id)
                      ? COLORS.selected
                      : warned.has(r.id)
                        ? WARNING_COLOR
                        : STATUS_COLORS[r.status]
                }
              />
            </mesh>
          ))}
          <CameraFit bounds={scene.bounds} />
          <OrbitControls makeDefault target={center} />
          <ProjectionHook container={container} />
        </Canvas>
      </div>
    </div>
  );
}
