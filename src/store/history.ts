/**
 * Projekt-Store mit benannten Befehlen und Undo/Redo über immer-Patches (design.md „Store mit Befehlen und Patches“).
 * Frei von React; die Oberfläche bindet ihn über zustand an.
 */
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Project } from "../model/types";

enablePatches();

export const HISTORY_LIMIT = 200;

/** Ein Befehl ändert das Projekt; das Label erscheint im Undo-Menü. */
export interface Command {
  label: string;
  run(draft: Draft<Project>): void;
}

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
}

export interface ProjectState {
  project: Project;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  /** Zählt jede Modelländerung durch Befehl, Undo oder Redo; Grundlage des Autospeicherns. */
  revision: number;
  /** Laufender Ziehvorgang: Ausgangszustand und Label. */
  transaction: {
    base: Project;
    label: string;
    recipe: ((draft: Draft<Project>) => void) | null;
  } | null;
}

export interface ProjectStore extends StoreApi<ProjectState> {
  execute(command: Command): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undoLabel(): string | undefined;
  redoLabel(): string | undefined;
  /** Beginnt einen Ziehvorgang; Zwischenstände erzeugen keine History-Einträge. */
  begin(label: string): void;
  /** Setzt den Zwischenstand neu, immer ausgehend vom Zustand bei begin(). */
  preview(recipe: (draft: Draft<Project>) => void): void;
  /** Schließt den Ziehvorgang als einen Befehl ab (beim Loslassen). */
  commit(): void;
  /** Bricht den Ziehvorgang ab und stellt den Ausgangszustand her. */
  cancel(): void;
  /** Ersetzt das Projekt (Laden, Neuladen) und leert die Historie. */
  reset(project: Project): void;
}

export function createProjectStore(project: Project): ProjectStore {
  const store = createStore<ProjectState>(() => ({
    project,
    undoStack: [],
    redoStack: [],
    revision: 0,
    transaction: null,
  }));

  const push = (entry: HistoryEntry, next: Project) => {
    const s = store.getState();
    const undoStack = [...s.undoStack, entry].slice(-HISTORY_LIMIT);
    store.setState({
      project: next,
      undoStack,
      redoStack: [],
      revision: s.revision + 1,
      transaction: null,
    });
  };

  const execute = (command: Command) => {
    const s = store.getState();
    if (s.transaction) throw new Error("Befehl während eines Ziehvorgangs");
    const [next, patches, inverse] = produceWithPatches(s.project, command.run);
    if (patches.length === 0) return;
    push({ label: command.label, patches, inverse }, next);
  };

  return Object.assign(store, {
    execute,
    undo() {
      const s = store.getState();
      const entry = s.undoStack.at(-1);
      if (!entry || s.transaction) return;
      store.setState({
        project: applyPatches(s.project, entry.inverse),
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, entry],
        revision: s.revision + 1,
      });
    },
    redo() {
      const s = store.getState();
      const entry = s.redoStack.at(-1);
      if (!entry || s.transaction) return;
      store.setState({
        project: applyPatches(s.project, entry.patches),
        undoStack: [...s.undoStack, entry],
        redoStack: s.redoStack.slice(0, -1),
        revision: s.revision + 1,
      });
    },
    canUndo: () => store.getState().undoStack.length > 0,
    canRedo: () => store.getState().redoStack.length > 0,
    undoLabel: () => store.getState().undoStack.at(-1)?.label,
    redoLabel: () => store.getState().redoStack.at(-1)?.label,
    begin(label: string) {
      const s = store.getState();
      if (s.transaction) throw new Error("Ziehvorgang läuft bereits");
      store.setState({ transaction: { base: s.project, label, recipe: null } });
    },
    preview(recipe: (draft: Draft<Project>) => void) {
      const t = store.getState().transaction;
      if (!t) throw new Error("Kein Ziehvorgang");
      const [next] = produceWithPatches(t.base, recipe);
      store.setState({ project: next, transaction: { ...t, recipe } });
    },
    commit() {
      const t = store.getState().transaction;
      if (!t) return;
      if (!t.recipe) {
        store.setState({ project: t.base, transaction: null });
        return;
      }
      const [next, patches, inverse] = produceWithPatches(t.base, t.recipe);
      if (patches.length === 0) {
        store.setState({ project: t.base, transaction: null });
        return;
      }
      push({ label: t.label, patches, inverse }, next);
    },
    cancel() {
      const t = store.getState().transaction;
      if (t) store.setState({ project: t.base, transaction: null });
    },
    reset(next: Project) {
      store.setState({ project: next, undoStack: [], redoStack: [], transaction: null });
    },
  });
}

/** Tastenkürzel: Cmd/Strg+Z = Rückgängig, Cmd/Strg+Shift+Z = Wiederholen. */
export function historyShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): "undo" | "redo" | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "z") return null;
  return e.shiftKey ? "redo" : "undo";
}
