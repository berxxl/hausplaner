/**
 * Auswahl und Ansicht (design.md „Oberfläche“): eine gemeinsame Auswahl für alle Ansichten.
 * Kein Teil des Projektmodells, daher nicht im Undo.
 */
import { createStore, type StoreApi } from "zustand/vanilla";

export type SelectableKind = "storey" | "wall" | "room" | "opening" | "slope";

export interface Selection {
  kind: SelectableKind;
  id: string;
}

export type EditorKind = "plan" | "surface" | "3d";

export interface ViewState {
  selection: Selection | null;
  /** Geschoss des Grundrisses und des Baums. */
  activeStoreyId: string | null;
  editor: EditorKind;
}

export interface ViewStore extends StoreApi<ViewState> {
  select(selection: Selection | null): void;
  isSelected(kind: SelectableKind, id: string): boolean;
  setActiveStorey(id: string | null): void;
  setEditor(editor: EditorKind): void;
  /** Entfernt eine Auswahl, deren Objekt nicht mehr existiert. */
  prune(exists: (selection: Selection) => boolean): void;
}

export function createViewStore(initial: Partial<ViewState> = {}): ViewStore {
  const store = createStore<ViewState>(() => ({
    selection: null,
    activeStoreyId: null,
    editor: "plan",
    ...initial,
  }));
  return Object.assign(store, {
    select(selection: Selection | null) {
      store.setState({ selection });
    },
    isSelected(kind: SelectableKind, id: string) {
      const s = store.getState().selection;
      return s?.kind === kind && s.id === id;
    },
    setActiveStorey(id: string | null) {
      store.setState({ activeStoreyId: id });
    },
    setEditor(editor: EditorKind) {
      store.setState({ editor });
    },
    prune(exists: (selection: Selection) => boolean) {
      const s = store.getState().selection;
      if (s && !exists(s)) store.setState({ selection: null });
    },
  });
}
