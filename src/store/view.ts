/**
 * Auswahl und Ansicht (design.md „Oberfläche“): eine gemeinsame Auswahl für alle Ansichten.
 * Kein Teil des Projektmodells, daher nicht im Undo.
 */
import { createStore, type StoreApi } from "zustand/vanilla";

export type SelectableKind =
  "storey" | "wall" | "room" | "opening" | "slope" | "device" | "furniture";

export interface Selection {
  kind: SelectableKind;
  id: string;
  /** Mehrfachauswahl von Geräten derselben Fläche (enthält `id`), design.md M2 „Auswahl“. */
  ids?: string[];
}

/** Werkzeug der Flächenansicht. */
export type SurfaceTool = "select" | "measure" | "device";

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
  | "device"
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
  surfaceTool: SurfaceTool;
  /** Gerätetyp der Werkzeuge „Gerät“ in Grundriss und Flächenansicht. */
  deviceTypeId: string | null;
  /** Overlay der Installationszonen in allen Wandansichten (nicht gespeichert). */
  showZones: boolean;
  /** Senkrechte Zuführungen der Wandgeräte in allen Wandansichten (nicht gespeichert). */
  showFeeds: boolean;
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
  /** Shift-Klick auf ein Gerät: hinzufügen oder entfernen (nur Geräte derselben Fläche, prüft der Aufrufer). */
  toggleDevice(id: string): void;
  /** Alle ausgewählten Geräte (leer, wenn keine Geräte ausgewählt sind). */
  selectedDevices(): string[];
  setSurfaceTool(tool: SurfaceTool): void;
  setDeviceType(typeId: string | null): void;
  setShowZones(show: boolean): void;
  setShowFeeds(show: boolean): void;
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
    surfaceTool: "select",
    deviceTypeId: null,
    showZones: false,
    showFeeds: false,
    ...initial,
  }));
  return Object.assign(store, {
    select(selection: Selection | null) {
      store.setState({ selection });
    },
    isSelected(kind: SelectableKind, id: string) {
      const s = store.getState().selection;
      return s?.kind === kind && (s.id === id || !!s.ids?.includes(id));
    },
    toggleDevice(id: string) {
      const s = store.getState().selection;
      if (s?.kind !== "device") return store.setState({ selection: { kind: "device", id } });
      const ids = s.ids ?? [s.id];
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      if (next.length === 0) return store.setState({ selection: null });
      store.setState({
        selection: {
          kind: "device",
          id: next[0]!,
          ...(next.length > 1 ? { ids: next } : {}),
        },
      });
    },
    selectedDevices() {
      const s = store.getState().selection;
      return s?.kind === "device" ? (s.ids ?? [s.id]) : [];
    },
    setSurfaceTool(surfaceTool: SurfaceTool) {
      store.setState({ surfaceTool });
    },
    setDeviceType(deviceTypeId: string | null) {
      store.setState({ deviceTypeId });
    },
    setShowZones(showZones: boolean) {
      store.setState({ showZones });
    },
    setShowFeeds(showFeeds: boolean) {
      store.setState({ showFeeds });
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
