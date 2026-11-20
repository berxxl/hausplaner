import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(__dirname, "..", "fixtures");

/** Alle *.yaml eines Fixture-Projekts als Pfad → Inhalt, wie GET /api/project sie liefert. */
export function readFixture(name: string): Record<string, string> {
  const dir = join(ROOT, name);
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".yaml"))
        files[relative(dir, p).split(sep).join("/")] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return files;
}
