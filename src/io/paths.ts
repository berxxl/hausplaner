export const PROJECT_FILE = "projekt.yaml";
const STOREY_FILE = /^geschosse\/([^/]+)\.yaml$/;

export function storeyFilePath(slug: string): string {
  return `geschosse/${slug}.yaml`;
}

/** Slug aus dem Pfad einer Geschossdatei, sonst null. */
export function storeySlugFromPath(path: string): string | null {
  return STOREY_FILE.exec(path)?.[1] ?? null;
}

/** Dateien, die M1 liest und schreibt. Alle anderen *.yaml werden ignoriert. */
export function isKnownFile(path: string): boolean {
  return path === PROJECT_FILE || storeySlugFromPath(path) !== null;
}
