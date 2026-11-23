/**
 * Befehle für gespeicherte 3D-Kamerapositionen (design.md M6 „Kamerapositionen“): speichern,
 * überschreiben, löschen. Frei von React.
 */
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import type { CameraView, Project } from "../model/types";
import type { Command } from "./history";

type Point3 = CameraView["position"];
const round = (p: Point3): Point3 => ({
  x: Math.round(p.x) || 0,
  y: Math.round(p.y) || 0,
  z: Math.round(p.z) || 0,
});

/** Ansicht mit diesem Namen (Groß-/Kleinschreibung zählt nicht, Leerzeichen am Rand nicht). */
export function cameraViewByName(project: Project, name: string): CameraView | undefined {
  const key = name.trim().toLocaleLowerCase("de");
  return project.cameraViews.find((v) => v.name.trim().toLocaleLowerCase("de") === key);
}

/** Vorschlag „Ansicht <n>“ mit dem kleinsten freien n ≥ 1. */
export function nextViewName(project: Project): string {
  for (let n = 1; ; n++) if (!cameraViewByName(project, `Ansicht ${n}`)) return `Ansicht ${n}`;
}

/**
 * „Ansicht speichern“ bzw. „Ansicht ändern“, wenn es den Namen schon gibt (die Rückfrage stellt
 * die Oberfläche). Leerer Name wird abgelehnt.
 */
export function saveCameraView(
  project: Project,
  view: { name: string; position: Point3; target: Point3; upToStoreyId: string | null },
): { ok: true; command: Command; id: string } | { ok: false; error: string } {
  const name = view.name.trim();
  if (!name) return { ok: false, error: "Name fehlt" };
  const existing = cameraViewByName(project, name);
  const id = existing?.id ?? newId(new Set(allIds(project)));
  const next: CameraView = {
    id,
    name,
    position: round(view.position),
    target: round(view.target),
    ...(view.upToStoreyId ? { upToStoreyId: view.upToStoreyId } : {}),
  };
  return {
    ok: true,
    id,
    command: {
      label: existing ? "Ansicht ändern" : "Ansicht speichern",
      run(draft) {
        const i = draft.cameraViews.findIndex((v) => v.id === id);
        if (i >= 0) draft.cameraViews[i] = next;
        else draft.cameraViews.push(next);
      },
    },
  };
}

export function deleteCameraView(id: string): Command {
  return {
    label: "Ansicht löschen",
    run(draft) {
      draft.cameraViews = draft.cameraViews.filter((v) => v.id !== id);
    },
  };
}
