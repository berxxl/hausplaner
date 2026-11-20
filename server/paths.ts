/** Pfadprüfung nach design.md „Server“: syntaktisch (400), dann realpath des nächsten existierenden Vorfahren (403). */
import { realpath } from "node:fs/promises";
import { dirname, join, relative, isAbsolute, sep } from "node:path";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Prüft einen relativen Pfad syntaktisch und liefert seine Segmente. */
export function checkSyntax(rawPath: string): string[] {
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    throw new HttpError(400, "invalid-path", `Ungültige Kodierung: ${rawPath}`);
  }
  if (path === "") throw new HttpError(400, "invalid-path", "Leerer Pfad");
  if (path.startsWith("/")) throw new HttpError(400, "invalid-path", `Absoluter Pfad: ${path}`);
  if (/^[A-Za-z]:/.test(path))
    throw new HttpError(400, "invalid-path", `Laufwerksbuchstabe: ${path}`);
  if (path.includes("\\")) throw new HttpError(400, "invalid-path", `Backslash im Pfad: ${path}`);
  if (path.includes("\0")) throw new HttpError(400, "invalid-path", "Nullzeichen im Pfad");
  const segments = path.split("/");
  for (const s of segments) {
    if (s === "" || s === "." || s === "..") {
      throw new HttpError(400, "invalid-path", `Ungültiges Segment im Pfad: ${path}`);
    }
  }
  return segments;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel) && rel.split(sep)[0] !== "..");
}

async function nearestExistingRealpath(abs: string): Promise<string> {
  let current = abs;
  for (;;) {
    try {
      return await realpath(current);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      const parent = dirname(current);
      if (parent === current) throw e;
      current = parent;
    }
  }
}

/**
 * Löst einen relativen Pfad im Projektordner auf. Wirft 400 bei ungültiger Syntax
 * und 403, wenn der realpath des nächsten existierenden Vorfahren außerhalb liegt.
 */
export async function resolveInProject(
  projectRoot: string,
  rawPath: string,
): Promise<{ rel: string; abs: string }> {
  const segments = checkSyntax(rawPath);
  const rel = segments.join("/");
  const abs = join(projectRoot, ...segments);
  const root = await realpath(projectRoot);
  const real = await nearestExistingRealpath(abs);
  if (!isInside(root, real)) {
    throw new HttpError(403, "outside-project", `Pfad liegt außerhalb des Projektordners: ${rel}`);
  }
  return { rel, abs };
}
