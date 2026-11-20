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
import type { Project } from "../../model/types";
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

interface SceneData {
  walls: { solid: WallSolid; geometry: THREE.BufferGeometry }[];
  polys: { poly: PlanarPolygon; geometry: THREE.BufferGeometry }[];
  bounds: THREE.Box3;
}

function buildScene(project: Project, upTo: string | null): SceneData {
  const walls: SceneData["walls"] = [];
  const polys: SceneData["polys"] = [];
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
  }
  return { walls, polys, bounds };
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
  selected: "#0071e3",
};

/** 3D-Ansicht des Gebäudes in Rohbaumaßen; Klick wählt Wand bzw. Raum. */
export function ModelView({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const selection = useStore(view, (s) => s.selection);
  const [upTo, setUpTo] = useState<string | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const scene = useMemo(() => buildScene(project, upTo), [project, upTo]);
  useEffect(() => () => scene.walls.forEach((w) => w.geometry.dispose()), [scene]);

  const isSel = (s: Selection | null, kind: Selection["kind"], id: string) =>
    s?.kind === kind && s.id === id;
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
          <CameraFit bounds={scene.bounds} />
          <OrbitControls makeDefault target={center} />
          <ProjectionHook container={container} />
        </Canvas>
      </div>
    </div>
  );
}
