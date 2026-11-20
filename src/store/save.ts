/**
 * Speichern (design.md „Speichern“, „Externe Änderungen“): schreibt jede Datei, deren Serialisierung
 * vom zuletzt gelesenen oder geschriebenen Inhalt abweicht. Frei von React.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import { projectToFiles } from "../io/project-files";
import type { Api } from "../io/api";
import type { Project } from "../model/types";
import type { ProjectStore } from "./history";

export const AUTOSAVE_DELAY_MS = 2000;
export const RETRY_INTERVAL_MS = 10000;

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export interface SaveState {
  status: SaveStatus;
  /** Fehlermeldungen je Datei beim letzten Versuch. */
  errors: Record<string, string>;
  /** Externe Änderungen gemeldet, Autospeichern pausiert, bis neu geladen oder Überschreiben bestätigt. */
  externalChanges: string[];
}

/** Dateien, die geschrieben werden müssen: Pfad → neuer Inhalt oder null (löschen). */
export function pendingChanges(
  project: Project,
  lastContents: Readonly<Record<string, string>>,
): Record<string, string | null> {
  const files = projectToFiles(project);
  const changes: Record<string, string | null> = {};
  for (const [path, content] of Object.entries(files)) {
    if (lastContents[path] !== content) changes[path] = content;
  }
  for (const path of Object.keys(lastContents)) {
    if (!(path in files)) changes[path] = null;
  }
  return changes;
}

export interface SaveController extends StoreApi<SaveState> {
  /** Cmd/Strg+S. Bei gemeldeten externen Änderungen nur mit `overwrite` (nach Bestätigung). */
  saveNow(options?: { overwrite?: boolean }): Promise<void>;
  /** Vom Server gemeldete externe Änderungen. */
  externalChange(paths: string[]): void;
  /** Nach Laden oder Neuladen: neue Vergleichsbasis, Pause aufgehoben. */
  loaded(contents: Record<string, string>): void;
  hasUnsavedChanges(): boolean;
  dispose(): void;
}

export function createSaveController(
  store: ProjectStore,
  api: Pick<Api, "putFiles">,
  initialContents: Record<string, string>,
): SaveController {
  let lastContents: Record<string, string> = { ...initialContents };
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;

  const state = createStore<SaveState>(() => ({
    status: "saved",
    errors: {},
    externalChanges: [],
  }));

  const statusFromDiff = () =>
    Object.keys(pendingChanges(store.getState().project, lastContents)).length > 0
      ? "unsaved"
      : "saved";

  const clearTimers = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    if (retryTimer) clearTimeout(retryTimer);
    autosaveTimer = retryTimer = null;
  };

  async function write(): Promise<void> {
    if (running) await running;
    const changes = pendingChanges(store.getState().project, lastContents);
    if (Object.keys(changes).length === 0) {
      state.setState({ status: "saved", errors: {} });
      return;
    }
    state.setState({ status: "saving" });
    const attempt = (async () => {
      const errors: Record<string, string> = {};
      try {
        const results = await api.putFiles(changes);
        for (const [path, content] of Object.entries(changes)) {
          const result = results[path];
          if (result === "ok") {
            if (content === null) delete lastContents[path];
            else lastContents[path] = content;
          } else {
            errors[path] = result?.error ?? "keine Antwort für diese Datei";
          }
        }
      } catch (e) {
        errors["*"] = (e as Error).message;
      }
      if (Object.keys(errors).length > 0) {
        state.setState({ status: "error", errors });
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (state.getState().externalChanges.length === 0) void write();
        }, RETRY_INTERVAL_MS);
      } else {
        state.setState({ status: statusFromDiff(), errors: {} });
      }
    })();
    running = attempt;
    await attempt;
    running = null;
  }

  // Autospeichern: nur Befehle (revision) lösen es aus.
  const unsubscribe = store.subscribe((s, prev) => {
    if (s.revision === prev.revision) return;
    if (state.getState().status !== "error") state.setState({ status: statusFromDiff() });
    if (state.getState().externalChanges.length > 0) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void write();
    }, AUTOSAVE_DELAY_MS);
  });

  state.setState({ status: statusFromDiff() });

  return Object.assign(state, {
    async saveNow(options?: { overwrite?: boolean }) {
      if (state.getState().externalChanges.length > 0) {
        if (!options?.overwrite) return;
        state.setState({ externalChanges: [] });
      }
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = null;
      await write();
    },
    externalChange(paths: string[]) {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = null;
      const merged = [...new Set([...state.getState().externalChanges, ...paths])].sort();
      state.setState({ externalChanges: merged });
    },
    loaded(contents: Record<string, string>) {
      clearTimers();
      lastContents = { ...contents };
      state.setState({ externalChanges: [], errors: {}, status: statusFromDiff() });
    },
    hasUnsavedChanges: () =>
      Object.keys(pendingChanges(store.getState().project, lastContents)).length > 0,
    dispose() {
      clearTimers();
      unsubscribe();
    },
  });
}
