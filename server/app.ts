/** Lokaler HTTP-Server: API für den Projektordner und optional die gebaute App aus dist/. */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize } from "node:path";
import { ProjectEvents } from "./events.ts";
import { HttpError, checkSyntax, resolveInProject } from "./paths.ts";
import { contentType, readProject, storePlan, writeFiles } from "./files.ts";

export const HOST = "127.0.0.1";
export const FIRST_PORT = 5180;
export const LAST_PORT = 5189;
const MAX_BODY = 200 * 1024 * 1024;

export interface AppOptions {
  projectDir: string;
  /** Verzeichnis der gebauten App; fehlt es, liefert der Server nur die API (npm run dev). */
  staticDir?: string;
}

export interface App {
  server: Server;
  events: ProjectEvents;
  close(): Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, e: unknown): void {
  if (e instanceof HttpError) {
    sendJson(res, e.status, { error: { code: e.code, message: e.message } });
  } else if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
    sendJson(res, 404, { error: { code: "not-found", message: "Datei nicht gefunden" } });
  } else {
    sendJson(res, 500, {
      error: { code: "internal", message: (e as Error)?.message ?? String(e) },
    });
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(400, "too-large", "Anfrage zu groß");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  try {
    return JSON.parse((await readBody(req)).toString("utf8"));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "invalid-body", "Ungültiges JSON");
  }
}

async function serveStatic(staticDir: string, urlPath: string, res: ServerResponse): Promise<void> {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  let file = join(staticDir, rel);
  if (!file.startsWith(staticDir)) throw new HttpError(400, "invalid-path", "Ungültiger Pfad");
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(staticDir, "index.html"); // SPA-Fallback
  }
  const data = await readFile(file);
  res.writeHead(200, { "content-type": contentType(file) });
  res.end(data);
}

export function createApp(options: AppOptions): App {
  const { projectDir, staticDir } = options;
  const events = new ProjectEvents(projectDir);
  void events.start();

  const server = createServer((req, res) => {
    void handle(req, res).catch((e) => sendError(res, e));
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Pfad roh aus req.url: new URL würde %2e%2e und .. vor der Pfadprüfung auflösen.
    const path = (req.url ?? "/").split("?")[0]!;
    const method = req.method ?? "GET";

    if (path === "/api/project" && method === "GET") {
      return sendJson(res, 200, await readProject(projectDir));
    }
    if (path === "/api/files" && method === "PUT") {
      const body = (await readJson(req)) as { files?: unknown };
      if (
        !body ||
        typeof body.files !== "object" ||
        body.files === null ||
        Array.isArray(body.files)
      ) {
        throw new HttpError(400, "invalid-body", 'Erwartet {"files": {…}}');
      }
      const results = await writeFiles(
        projectDir,
        body.files as Record<string, string | null>,
        events,
      );
      await events.start();
      return sendJson(res, 200, { results });
    }
    if (path === "/api/events" && method === "GET") {
      await events.start();
      return events.subscribe(res);
    }
    if (path.startsWith("/api/raw/")) {
      const rawPath = path.slice("/api/raw/".length);
      if (method === "GET") {
        const { abs } = await resolveInProject(projectDir, rawPath);
        const data = await readFile(abs);
        res.writeHead(200, { "content-type": contentType(abs) });
        res.end(data);
        return;
      }
      if (method === "PUT") {
        const segments = checkSyntax(rawPath);
        if (segments.length !== 2 || segments[0] !== "plaene") {
          throw new HttpError(400, "invalid-path", "Hochladen nur direkt unter plaene/");
        }
        const result = await storePlan(projectDir, segments[1]!, await readBody(req));
        await events.start();
        return sendJson(res, result.status, { path: result.path });
      }
    }
    if (path.startsWith("/api/")) {
      throw new HttpError(404, "not-found", `Unbekannter Endpunkt: ${method} ${path}`);
    }
    if (staticDir && method === "GET") return serveStatic(staticDir, path, res);
    throw new HttpError(404, "not-found", "Nicht gefunden");
  }

  return {
    server,
    events,
    async close() {
      await events.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Lauscht auf 127.0.0.1, ab `first` bis `last` der erste freie Port. */
export async function listen(
  server: Server,
  first = FIRST_PORT,
  last = LAST_PORT,
): Promise<number> {
  for (let port = first; port <= last; port++) {
    const ok = await new Promise<boolean>((resolve, reject) => {
      const onError = (e: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        if (e.code === "EADDRINUSE") resolve(false);
        else reject(e);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(true);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, HOST);
    });
    if (ok) return port;
  }
  throw new Error(`Kein freier Port zwischen ${first} und ${last}`);
}
