/** Beobachtung des Projektordners: meldet externe Änderungen an *.yaml per SSE, 300 ms entprellt. */
import type { ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { relative, sep } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { exists, sha256, type OwnWrites } from "./files.ts";

export const DEBOUNCE_MS = 300;
const DELETED = "deleted";

export class ProjectEvents implements OwnWrites {
  private readonly root: string;
  private watcher: FSWatcher | null = null;
  private readonly clients = new Set<ServerResponse>();
  /** Zuletzt selbst hergestellter Zustand je Datei: SHA-256 des Inhalts oder DELETED. */
  private readonly own = new Map<string, string>();
  private pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private ready: Promise<void> = Promise.resolve();

  constructor(root: string) {
    this.root = root;
  }

  written(rel: string, hash: string): void {
    this.own.set(rel, hash);
  }

  deleted(rel: string): void {
    this.own.set(rel, DELETED);
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
    for (const event of ["add", "change", "unlink"] as const)
      watcher.on(event, (p) => void this.onChange(p));
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

  /**
   * Vergleicht den aktuellen Zustand der Datei mit dem zuletzt selbst geschriebenen, statt
   * einzelne Ereignisse abzuhaken: Beobachter melden je nach System doppelt, verspätet oder
   * in anderer Reihenfolge (z. B. „add“ erst nach dem eigenen Löschen).
   */
  private async onChange(absPath: string): Promise<void> {
    const rel = relative(this.root, absPath).split(sep).join("/");
    if (!rel.endsWith(".yaml") || rel.startsWith("plaene/")) return;
    let state: string;
    try {
      state = sha256(await readFile(absPath, "utf8"));
    } catch {
      state = DELETED;
    }
    if (state === this.own.get(rel)) return;
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
