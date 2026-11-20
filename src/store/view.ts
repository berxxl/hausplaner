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

/** Was die Flächenansicht zeigt. */
export type SurfaceTarget =
  | { kind: "room-wall"; key: string }
  | { kind: "wall-side"; ref: string }
  | { kind: "ceiling"; roomId: string }
  | { kind: "floor"; roomId: string }
  | { kind: "slope"; roomId: string; slopeId: string };

export type PlanTool =
  | "select"
  | "measure"
  | "wall"
  | "room"
  | "opening"
  | "slope"
  | "redetect-room"
  | "calibrate"
  | "move-underlay"
  | "rotate-underlay";

export interface ViewState {
  selection: Selection | null;
  /** Geschoss des Grundrisses und des Baums. */
  activeStoreyId: string | null;
  editor: EditorKind;
  planTool: PlanTool;
  /** Raum, auf den sich „Raum neu erkennen“ und „Schräge hinzufügen“ beziehen. */
  toolRoomId: string | null;
  /** Dicke der zuletzt gezeichneten Wand (Start 240 mm). */
  lastThicknessMm: number;
  /** Offene Fläche im Editor „Fläche“. */
  surface: SurfaceTarget | null;
}

export interface ViewStore extends StoreApi<ViewState> {
  select(selection: Selection | null): void;
  isSelected(kind: SelectableKind, id: string): boolean;
  setActiveStorey(id: string | null): void;
  setEditor(editor: EditorKind): void;
  setPlanTool(tool: PlanTool, roomId?: string): void;
  setLastThickness(mm: number): void;
  /** Öffnet eine Fläche im Editor „Fläche“. */
  openSurface(target: SurfaceTarget, storeyId?: string): void;
  /** Entfernt eine Auswahl, deren Objekt nicht mehr existiert. */
  prune(exists: (selection: Selection) => boolean): void;
}

export function createViewStore(initial: Partial<ViewState> = {}): ViewStore {
  const store = createStore<ViewState>(() => ({
    selection: null,
    activeStoreyId: null,
    editor: "plan",
    planTool: "select",
    toolRoomId: null,
    lastThicknessMm: 240,
    surface: null,
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
    setPlanTool(planTool: PlanTool, roomId?: string) {
      store.setState({ planTool, toolRoomId: roomId ?? null, editor: "plan" });
    },
    setLastThickness(lastThicknessMm: number) {
      store.setState({ lastThicknessMm });
    },
    openSurface(surface: SurfaceTarget, storeyId?: string) {
      store.setState({
        surface,
        editor: "surface",
        ...(storeyId ? { activeStoreyId: storeyId } : {}),
      });
    },
    prune(exists: (selection: Selection) => boolean) {
      const s = store.getState().selection;
      if (s && !exists(s)) store.setState({ selection: null });
    },
  });
}
