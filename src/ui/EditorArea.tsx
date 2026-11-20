import { useStore } from "zustand";
import type { ProjectStore } from "../store/history";
import type { EditorKind, ViewStore } from "../store/view";
import { PlanView } from "./plan/PlanView";
import { SurfaceView } from "./surface/SurfaceView";
import { lazy, Suspense } from "react";

// three.js nur laden, wenn die 3D-Ansicht geöffnet wird
const ModelView = lazy(() => import("./three/ModelView").then((m) => ({ default: m.ModelView })));

const TABS: { kind: EditorKind; label: string }[] = [
  { kind: "plan", label: "Grundriss" },
  { kind: "surface", label: "Fläche" },
  { kind: "3d", label: "3D" },
];

/** Editorbereich mit Umschaltung zwischen Grundriss, Flächenansicht und 3D. */
export function EditorArea({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const editor = useStore(view, (s) => s.editor);
  const active = TABS.find((t) => t.kind === editor)!;
  return (
    <main aria-label="Editor" className="editor">
      <div role="tablist" aria-label="Ansicht" className="editor__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            id={`tab-${tab.kind}`}
            aria-selected={tab.kind === editor}
            aria-controls="editor-panel"
            onClick={() => view.setEditor(tab.kind)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="editor-panel"
        aria-labelledby={`tab-${active.kind}`}
        className="editor__panel"
      >
        {editor === "plan" ? (
          <PlanView store={store} view={view} />
        ) : editor === "surface" ? (
          <SurfaceView store={store} view={view} />
        ) : (
          <Suspense fallback={<p className="placeholder">Lade 3D …</p>}>
            <ModelView store={store} view={view} />
          </Suspense>
        )}
      </div>
    </main>
  );
}
