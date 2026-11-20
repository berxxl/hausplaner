/** Gemeinsames für die Startbefehle. */
import { resolve } from "node:path";
import { spawn } from "node:child_process";

/** Projektordner aus dem ersten Argument, relativ zum Aufrufort (npm setzt INIT_CWD). */
export function projectDirFromArgs(args: string[]): { projectDir: string; rest: string[] } {
  const [dir, ...rest] = args;
  if (!dir || dir.startsWith("-")) {
    console.error("Aufruf: npm start -- <projektordner>");
    process.exit(1);
  }
  return { projectDir: resolve(process.env.INIT_CWD ?? process.cwd(), dir), rest };
}

export function openBrowser(url: string): void {
  if (process.env.HAUSPLANER_NO_OPEN === "1") return;
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`Browser bitte selbst öffnen: ${url}`));
  child.unref();
}
