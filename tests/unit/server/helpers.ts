import { request } from "node:http";
import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, listen, type App } from "../../../server/app.ts";

export async function tempDir(): Promise<string> {
  return realpath(await mkdtemp(join(tmpdir(), "hausplaner-")));
}

export interface Running {
  app: App;
  port: number;
  root: string;
}

let nextPort = 15200 + Math.floor(Math.random() * 400);

export async function startApp(root: string): Promise<Running> {
  const app = createApp({ projectDir: root });
  const port = await listen(app.server, nextPort, nextPort + 50);
  nextPort = port + 1;
  await app.events.start();
  return { app, port, root };
}

export interface Reply {
  status: number;
  body: Buffer;
  json<T = unknown>(): T;
}

/** HTTP-Anfrage ohne Pfadnormalisierung (anders als fetch). */
export function call(
  port: number,
  method: string,
  path: string,
  body?: string | Buffer,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode ?? 0,
          body: buf,
          json: () => JSON.parse(buf.toString("utf8")),
        });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

export const putFiles = (port: number, files: Record<string, string | null>) =>
  call(port, "PUT", "/api/files", JSON.stringify({ files }));
