/** Client für die Server-API (design.md „Server“). */

export type FileResult = "ok" | { error: string };

export type ProjectListing =
  | { status: "ok"; folder: string; files: Record<string, string> }
  | { status: "empty"; folder: string }
  | { status: "missing"; folder: string };

export interface Api {
  getProject(): Promise<ProjectListing>;
  putFiles(files: Record<string, string | null>): Promise<Record<string, FileResult>>;
  putPlan(name: string, data: Blob | ArrayBuffer): Promise<{ path: string }>;
  /** Meldet externe Änderungen; liefert eine Funktion zum Abmelden. */
  onExternalChange(listener: (paths: string[]) => void): () => void;
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export const httpApi: Api = {
  async getProject() {
    const res = await fetch("/api/project");
    if (!res.ok) throw new Error(await errorText(res));
    return (await res.json()) as ProjectListing;
  },
  async putFiles(files) {
    const res = await fetch("/api/files", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    return ((await res.json()) as { results: Record<string, FileResult> }).results;
  },
  async putPlan(name, data) {
    const res = await fetch(`/api/raw/plaene/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: data,
    });
    if (!res.ok) throw new Error(await errorText(res));
    return (await res.json()) as { path: string };
  },
  onExternalChange(listener) {
    const source = new EventSource("/api/events");
    const handler = (e: MessageEvent<string>) =>
      listener((JSON.parse(e.data) as { paths: string[] }).paths);
    source.addEventListener("changed", handler);
    return () => source.close();
  },
};
