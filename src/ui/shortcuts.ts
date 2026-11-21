import { useEffect } from "react";
import { historyShortcut, type ProjectStore } from "../store/history";

export interface ShortcutHandlers {
  store: ProjectStore;
  /** Cmd/Strg+S */
  onSave(): void;
}

export function isSaveShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s";
}

/** Globale Kürzel: Speichern, Rückgängig, Wiederholen. */
export function useGlobalShortcuts({ store, onSave }: ShortcutHandlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isSaveShortcut(e)) {
        e.preventDefault();
        onSave();
        return;
      }
      // Texteingaben behalten ihr eigenes Undo
      if (isTextInput(e.target)) return;
      const action = historyShortcut(e);
      if (action) {
        e.preventDefault();
        if (action === "undo") store.undo();
        else store.redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, onSave]);
}

const NON_TEXT_INPUTS = new Set([
  "checkbox",
  "radio",
  "range",
  "button",
  "submit",
  "reset",
  "file",
  "color",
]);

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return !!target.closest("textarea, [contenteditable=true]");
}

/** Tastendruck in einem Eingabefeld: Kürzel der Ansichten nicht auslösen. */
export function isTextTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.isContentEditable ||
      t.tagName === "TEXTAREA" ||
      (t.tagName === "INPUT" &&
        !["checkbox", "radio", "range", "button"].includes((t as HTMLInputElement).type)) ||
      t.tagName === "SELECT")
  );
}
