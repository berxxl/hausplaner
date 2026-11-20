/** Beobachtung des Projektordners: meldet externe Änderungen an *.yaml per SSE, 300 ms entprellt. */
import type { ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
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

  /** Merkt geänderte *.yaml vor; ob die Änderung fremd ist, entscheidet erst `flush`. */
  private onChange(absPath: string): void {
    const rel = relative(this.root, absPath).split(sep).join("/");
    if (!rel.endsWith(".yaml") || rel.startsWith("plaene/")) return;
    this.pending.add(rel);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  private async state(rel: string): Promise<string> {
    try {
      return sha256(await readFile(join(this.root, rel), "utf8"));
    } catch {
      return DELETED;
    }
  }

  /**
   * Meldet nach der Entprellung nur Dateien, deren aktueller Zustand vom zuletzt selbst
   * geschriebenen abweicht. Der Vergleich erst hier statt je Ereignis macht die Filterung
   * unabhängig davon, ob der Beobachter doppelt, verspätet oder umgeordnet meldet oder ein
   * Ereignis mitten in einem eigenen Schreibvorgang eintrifft.
   */
  private async flush(): Promise<void> {
    this.timer = null;
    const candidates = [...this.pending].sort();
    this.pending = new Set();
    const paths: string[] = [];
    for (const rel of candidates) {
      if ((await this.state(rel)) !== this.own.get(rel)) paths.push(rel);
    }
    if (paths.length === 0) return;
    const data = `event: changed\ndata: ${JSON.stringify({ paths })}\n\n`;
    for (const c of this.clients) c.write(data);
  }
}
