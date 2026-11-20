import type { Api, FileResult, ProjectListing } from "../../src/io/api";

/** Server-Attrappe mit Dateien im Speicher. */
export function mockApi(initial: Record<string, string> | "missing" = {}, folder = "haus-daten") {
  let files: Record<string, string> | null = initial === "missing" ? null : { ...initial };
  const failing = new Set<string>();
  const listeners = new Set<(paths: string[]) => void>();
  const api = {
    getProject: vi.fn(async (): Promise<ProjectListing> => {
      if (files === null) return { status: "missing", folder };
      return Object.keys(files).length === 0
        ? { status: "empty", folder }
        : { status: "ok", folder, files: { ...files } };
    }),
    putFiles: vi.fn(async (changes: Record<string, string | null>) => {
      files ??= {};
      const results: Record<string, FileResult> = {};
      for (const [path, content] of Object.entries(changes)) {
        if (failing.has(path)) {
          results[path] = { error: "schreibgeschützt" };
          continue;
        }
        if (content === null) delete files[path];
        else files[path] = content;
        results[path] = "ok";
      }
      return results;
    }),
    putPlan: vi.fn(async (name: string) => ({ path: `plaene/${name}` })),
    onExternalChange: vi.fn((listener: (paths: string[]) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  } satisfies Api;
  return {
    api,
    failing,
    files: () => files,
    /** Simuliert eine Änderung außerhalb der App (z. B. git pull). */
    externalWrite(path: string, content: string | null) {
      files ??= {};
      if (content === null) delete files[path];
      else files[path] = content;
      for (const l of listeners) l([path]);
    },
  };
}
