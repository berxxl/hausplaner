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
      if (
        e.target instanceof Element &&
        e.target.closest("input, textarea, [contenteditable=true]")
      )
        return;
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
