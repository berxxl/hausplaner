/**
 * Sitzung: lädt das Projekt über die API, hält Store und Speichern und reagiert auf externe Änderungen.
 * Frei von React.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Api } from "../io/api";
import { loadProject, type LoadError } from "../io/load";
import { projectToFiles } from "../io/project-files";
import { CATALOG_FILE } from "../io/paths";
import type { Project } from "../model/types";
import { createProjectStore, type ProjectStore } from "../store/history";
import { createSaveController, type SaveController } from "../store/save";

export type Phase =
  | { kind: "loading" }
  | { kind: "error"; errors: LoadError[] }
  | { kind: "empty"; missing: boolean; folder: string }
  | {
      kind: "open";
      store: ProjectStore;
      save: SaveController;
      notice?: string;
      generation: number;
    };

export interface SessionState {
  phase: Phase;
}

export interface Session extends StoreApi<SessionState> {
  readonly api: Api;
  start(): Promise<void>;
  /** Lädt neu; verwirft ungespeicherte Änderungen und leert die Undo-Historie. */
  reload(): Promise<void>;
  /** Schreibt ein neues Projekt sofort (projekt.yaml und Geschossdatei) und öffnet es. */
  createProject(project: Project): Promise<void>;
  dispose(): void;
}

export function createSession(api: Api): Session {
  const state = createStore<SessionState>(() => ({ phase: { kind: "loading" } }));
  let stopEvents: (() => void) | null = null;
  let generation = 0;
  /** Dateien des zuletzt gelesenen Ordners (für „Neues Projekt“ mit vorhandener katalog.yaml). */
  let listedFiles: Record<string, string> = {};

  const closeOpen = () => {
    const phase = state.getState().phase;
    if (phase.kind === "open") phase.save.dispose();
  };

  async function load(): Promise<void> {
    let listing;
    try {
      listing = await api.getProject();
    } catch (e) {
      closeOpen();
      state.setState({
        phase: {
          kind: "error",
          errors: [{ file: "", message: `Server nicht erreichbar: ${(e as Error).message}` }],
        },
      });
      return;
    }
    closeOpen();
    listedFiles = listing.status === "ok" ? listing.files : {};
    if (listing.status !== "ok") {
      state.setState({
        phase: { kind: "empty", missing: listing.status === "missing", folder: listing.folder },
      });
      return;
    }
    const result = loadProject(listing.files);
    if (result.status === "empty") {
      state.setState({ phase: { kind: "empty", missing: false, folder: listing.folder } });
    } else if (result.status === "error") {
      state.setState({ phase: { kind: "error", errors: result.errors } });
    } else {
      const store = createProjectStore(result.project);
      const save = createSaveController(store, api, result.contents);
      state.setState({
        phase: {
          kind: "open",
          store,
          save,
          generation: ++generation,
          ...(result.notice ? { notice: result.notice } : {}),
        },
      });
    }
  }

  function onExternalChange(paths: string[]): void {
    const phase = state.getState().phase;
    if (phase.kind === "open") phase.save.externalChange(paths);
    else if (phase.kind !== "loading") void load(); // Fehlerseite oder leerer Ordner: automatisch neu laden
  }

  return Object.assign(state, {
    api,
    async start() {
      stopEvents ??= api.onExternalChange(onExternalChange);
      await load();
    },
    reload: load,
    async createProject(project: Project) {
      const files = projectToFiles(project);
      // Eine vorhandene katalog.yaml wird übernommen, nicht überschrieben (design.md M2)
      if (CATALOG_FILE in listedFiles) delete files[CATALOG_FILE];
      const results = await api.putFiles(files);
      const failed = Object.entries(results).filter(([, r]) => r !== "ok");
      if (failed.length > 0) {
        throw new Error(
          failed.map(([p, r]) => `${p}: ${typeof r === "object" ? r.error : r}`).join("; "),
        );
      }
      await load();
    },
    dispose() {
      stopEvents?.();
      stopEvents = null;
      closeOpen();
    },
  });
}
