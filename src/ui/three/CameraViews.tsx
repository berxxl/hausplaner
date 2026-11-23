/**
 * Gespeicherte Kamerapositionen (design.md M6 „Kamerapositionen“): Auswahl „Ansicht“,
 * „Ansicht speichern …“ mit Überschreiben nach Rückfrage, „Ansicht löschen“.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";
import type { CameraView, Project } from "../../model/types";
import type { ProjectStore } from "../../store/history";
import {
  cameraViewByName,
  deleteCameraView,
  nextViewName,
  saveCameraView,
} from "../../store/views3d";
import { useConfirm } from "../useConfirm";

type Point3 = CameraView["position"];
export interface CameraApi {
  get(): { position: Point3; target: Point3 };
  set(position: Point3, target: Point3): void;
}

const M = 0.001;
const toWorld = (v: THREE.Vector3): Point3 => ({ x: v.x / M, y: -v.z / M, z: v.y / M });
const toThree = (p: Point3) => new THREE.Vector3(p.x * M, p.z * M, -p.y * M);

interface Controls {
  target: THREE.Vector3;
  enableDamping: boolean;
  update(): void;
}

/** Kamera lesen und setzen; muss innerhalb des Canvas stehen. */
export function CameraHook({ register }: { register(api: CameraApi | null): void }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    const c = controls as unknown as Controls | null;
    register({
      get: () => ({
        position: toWorld(camera.position),
        target: toWorld(c?.target ?? new THREE.Vector3()),
      }),
      set(position, target) {
        // Restbewegung der Dämpfung verwerfen, sonst driftet die Kamera nach dem Setzen weiter
        if (c) {
          const damping = c.enableDamping;
          c.enableDamping = false;
          c.update();
          camera.position.copy(toThree(position));
          c.target.copy(toThree(target));
          c.update();
          c.enableDamping = damping;
        } else {
          camera.position.copy(toThree(position));
          camera.lookAt(toThree(target));
        }
        invalidate();
      },
    });
    return () => register(null);
  }, [camera, controls, invalidate, register]);
  return null;
}

export function CameraViews({
  project,
  store,
  camera,
  upTo,
  onRecall,
}: {
  project: Project;
  store: ProjectStore;
  camera(): CameraApi | null;
  upTo: string | null;
  /** setzt „Anzeigen bis“ und danach die Kamera */
  onRecall(view: CameraView): void;
}) {
  const [selected, setSelected] = useState("");
  const [naming, setNaming] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const views = [...project.cameraViews].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const current = views.find((v) => v.id === selected);
  const save = async (name: string) => {
    const api = camera();
    if (!api) return;
    const existing = cameraViewByName(project, name);
    if (
      existing &&
      !(await confirm({
        title: "Ansicht überschreiben?",
        message: `Die Ansicht „${existing.name}“ gibt es schon. Mit der aktuellen Kamera überschreiben?`,
        confirmLabel: "Überschreiben",
      }))
    )
      return;
    const r = saveCameraView(project, { name, ...api.get(), upToStoreyId: upTo });
    if (!r.ok) return;
    store.execute(r.command);
    setSelected(r.id);
    setNaming(null);
  };
  return (
    <span className="camera-views">
      <label>
        Ansicht{" "}
        <select
          aria-label="Gespeicherte Ansicht"
          value={current ? current.id : ""}
          onChange={(e) => {
            setSelected(e.target.value);
            const v = views.find((x) => x.id === e.target.value);
            if (v) onRecall(v);
          }}
        >
          <option value="">–</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => setNaming(nextViewName(project))}>
        Ansicht speichern …
      </button>
      <button
        type="button"
        disabled={!current}
        onClick={() => {
          if (!current) return;
          store.execute(deleteCameraView(current.id));
          setSelected("");
        }}
      >
        Ansicht löschen
      </button>
      {naming !== null && (
        <form
          className="image-menu__body"
          aria-label="Ansicht speichern"
          onSubmit={(e) => {
            e.preventDefault();
            void save(naming);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setNaming(null);
          }}
        >
          <label>
            Name{" "}
            <input
              autoFocus
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              aria-label="Name der Ansicht"
            />
          </label>
          <button type="submit" disabled={!naming.trim()}>
            Speichern
          </button>
          <button type="button" onClick={() => setNaming(null)}>
            Abbrechen
          </button>
        </form>
      )}
      {dialog}
    </span>
  );
}
