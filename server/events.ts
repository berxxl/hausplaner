/** Beobachtung des Projektordners: meldet externe Änderungen an *.yaml per SSE, 300 ms entprellt. */
import type { ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { relative, sep } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { exists, sha256, type OwnWrites } from "./files.ts";

export const DEBOUNCE_MS = 300;

export class ProjectEvents implements OwnWrites {
  private readonly root: string;
  private watcher: FSWatcher | null = null;
  private readonly clients = new Set<ServerResponse>();
  private readonly ownHashes = new Map<string, string>();
  private readonly ownDeletes = new Set<string>();
  private pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private ready: Promise<void> = Promise.resolve();

  constructor(root: string) {
    this.root = root;
  }

  written(rel: string, hash: string): void {
    this.ownHashes.set(rel, hash);
    this.ownDeletes.delete(rel);
  }

  deleted(rel: string): void {
    this.ownDeletes.add(rel);
    this.ownHashes.delete(rel);
  }

  /** Startet die Beobachtung, sobald der Ordner existiert; mehrfach aufrufbar. */
  async start(): Promise<void> {
    if (this.watcher || !(await exists(this.root))) return this.ready;
    const watcher = watch(this.root, {
      ignoreInitial: true,
      ignored: (path: string) =>
        /(^|[\\/])(\.git|node_modules)([\\/]|$)/.test(relative(this.root, path)),
    });
    this.watcher = watcher;
    this.ready = new Promise((resolve) => watcher.once("ready", () => resolve()));
    watcher.on("add", (p) => void this.onChange(p, false));
    watcher.on("change", (p) => void this.onChange(p, false));
    watcher.on("unlink", (p) => void this.onChange(p, true));
    return this.ready;
  }

  async close(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    for (const c of this.clients) c.end();
    this.clients.clear();
    await this.watcher?.close();
    this.watcher = null;
  }

  subscribe(res: ServerResponse): void {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(": verbunden\n\n");
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }

  private async onChange(absPath: string, removed: boolean): Promise<void> {
    const rel = relative(this.root, absPath).split(sep).join("/");
    if (!rel.endsWith(".yaml") || rel.startsWith("plaene/")) return;
    if (removed) {
      if (this.ownDeletes.delete(rel)) return;
    } else {
      let content: string;
      try {
        content = await readFile(absPath, "utf8");
      } catch {
        // Datei inzwischen wieder weg (z. B. verspätete Meldung nach eigenem Schreiben und
        // Löschen): die Lösch-Meldung entscheidet
        return;
      }
      if (sha256(content) === this.ownHashes.get(rel)) return;
    }
    this.pending.add(rel);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  private flush(): void {
    this.timer = null;
    const paths = [...this.pending].sort();
    this.pending = new Set();
    const data = `event: changed\ndata: ${JSON.stringify({ paths })}\n\n`;
    for (const c of this.clients) c.write(data);
  }
}
