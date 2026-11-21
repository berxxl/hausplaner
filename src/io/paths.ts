export const PROJECT_FILE = "projekt.yaml";
export const CATALOG_FILE = "katalog.yaml";
export const WARNINGS_FILE = "warnungen.yaml";
const STOREY_FILE = /^geschosse\/([^/]+)\.yaml$/;

export function storeyFilePath(slug: string): string {
  return `geschosse/${slug}.yaml`;
}

/** Slug aus dem Pfad einer Geschossdatei, sonst null. */
export function storeySlugFromPath(path: string): string | null {
  return STOREY_FILE.exec(path)?.[1] ?? null;
}

/** Dateien, die die App liest und schreibt. Alle anderen *.yaml werden ignoriert. */
export function isKnownFile(path: string): boolean {
  return (
    path === PROJECT_FILE ||
    path === CATALOG_FILE ||
    path === WARNINGS_FILE ||
    storeySlugFromPath(path) !== null
  );
}
