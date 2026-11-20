import { useStore } from "zustand";
import type { EditorKind, ViewStore } from "../store/view";

const TABS: { kind: EditorKind; label: string }[] = [
  { kind: "plan", label: "Grundriss" },
  { kind: "surface", label: "Fläche" },
  { kind: "3d", label: "3D" },
];

/** Editorbereich mit Umschaltung zwischen Grundriss, Flächenansicht und 3D. */
export function EditorArea({ view }: { view: ViewStore }) {
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
        <p className="placeholder">{active.label}</p>
      </div>
    </main>
  );
}
