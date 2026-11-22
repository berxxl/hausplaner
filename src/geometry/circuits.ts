/**
 * Stromkreise (design.md M4 „Stromkreise“): Kurzname, speisender Verteiler, Leitungen eines
 * Stromkreises. Alles abgeleitet, nichts gespeichert. Frei von React.
 */
import { pointInPolygon } from "./polygon";
import { wallDeviceRoom } from "./devices";
import { boardDevices } from "./boards";
import type { Cable, Circuit, Device, Project, Room } from "../model/types";

/** „F12“ aus „F12 Küche Steckdosen“: Text bis zum ersten Leerzeichen. */
export function circuitShortName(label: string): string {
  const t = label.trim();
  const i = t.indexOf(" ");
  return i < 0 ? t : t.slice(0, i);
}

export const lineTypeTrade = (project: Project, cable: Cable) =>
  project.catalog.lineTypes.find((t) => t.id === cable.lineTypeId)?.trade;

const typeOf = (project: Project, d: Device) =>
  project.catalog.deviceTypes.find((t) => t.id === d.typeId);

/** Geräte, die einem Stromkreis zugeordnet werden können: Gewerk Strom, nicht im Verteiler. */
export function isCircuitDevice(project: Project, d: Device): boolean {
  return d.placement.kind !== "board" && typeOf(project, d)?.trade === "power";
}

const memo = new WeakMap<Project, Map<string, string[]>>();

/**
 * Speisende Verteiler eines Geräts: Breitensuche über Leitungen des Gewerks Strom von Gerät zu
 * Gerät bis zu Verteilern; durch Verteiler hindurch geht die Suche nicht. Sortiert nach ID.
 */
export function feedingBoards(project: Project, deviceId: string): string[] {
  let cache = memo.get(project);
  if (!cache) {
    cache = new Map();
    memo.set(project, cache);
  }
  const hit = cache.get(deviceId);
  if (hit) return hit;
  const power = project.cables.filter((c) => lineTypeTrade(project, c) === "power");
  const boards = new Set<string>();
  const seen = new Set([deviceId]);
  const queue = [deviceId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of power) {
      const ends = [c.from, c.to];
      if (!ends.some((e) => e.deviceId === id)) continue;
      for (const e of ends) {
        if (e.boardId !== undefined) boards.add(e.boardId);
        else if (e.deviceId !== undefined && !seen.has(e.deviceId)) {
          seen.add(e.deviceId);
          queue.push(e.deviceId);
        }
      }
    }
  }
  const result = [...boards].filter((b) => project.boards.some((x) => x.id === b)).sort();
  cache.set(deviceId, result);
  return result;
}

/** Stromkreis einer Leitung (abgeleitet): beide Endpunkte Geräte von C oder Gerät von C + Verteiler von C. */
export function cableCircuit(project: Project, cable: Cable): Circuit | undefined {
  if (lineTypeTrade(project, cable) !== "power") return undefined;
  const circuitOf = (deviceId: string | undefined) =>
    deviceId === undefined ? undefined : project.devices.find((d) => d.id === deviceId)?.circuitId;
  const a = circuitOf(cable.from.deviceId);
  const b = circuitOf(cable.to.deviceId);
  let id: string | undefined;
  if (a !== undefined && b !== undefined) id = a === b ? a : undefined;
  else if (a !== undefined && cable.to.boardId !== undefined) id = a;
  else if (b !== undefined && cable.from.boardId !== undefined) id = b;
  const circuit = id === undefined ? undefined : project.circuits.find((c) => c.id === id);
  if (!circuit) return undefined;
  const boardEnd = cable.from.boardId ?? cable.to.boardId;
  return boardEnd === undefined || boardEnd === circuit.boardId ? circuit : undefined;
}

export const circuitDevices = (project: Project, circuitId: string): Device[] =>
  project.devices.filter((d) => d.circuitId === circuitId);

export const circuitCables = (project: Project, circuitId: string): Cable[] =>
  project.cables.filter((c) => cableCircuit(project, c)?.id === circuitId);

/** Raum eines Geräts (Wand: Abschnitt, Decke/Boden/Schräge: aus der Fläche, frei: Grundrisspunkt). */
export function deviceRoom(project: Project, device: Device): Room | null {
  const p = device.placement;
  if (p.kind === "board") return null;
  if (p.kind === "free")
    return (
      project.rooms.find(
        (r) =>
          r.storeyId === device.storeyId &&
          r.polygon.length >= 3 &&
          pointInPolygon({ x: p.x, y: p.y }, r.polygon),
      ) ?? null
    );
  if (p.surface.startsWith("wall:")) return wallDeviceRoom(project, device);
  const roomId = p.surface.split(":")[1];
  return project.rooms.find((r) => r.id === roomId) ?? null;
}

/** Nächste freie Bezeichnung „F<n>“ (höchste Zahl hinter führendem F + 1). */
export function nextCircuitLabel(project: Project): string {
  const numbers = project.circuits
    .map((c) => /^F(\d+)/.exec(c.label.trim())?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return `F${numbers.length > 0 ? Math.max(...numbers) + 1 : 1}`;
}

/** Schutzgeräte: Reiheneinbaugeräte des Verteilers, Gewerk Strom, kein Aktor. */
export function protectionDevices(project: Project, boardId: string): Device[] {
  return boardDevices(project, boardId).filter((d) => {
    const t = project.catalog.deviceTypes.find((x) => x.id === d.typeId);
    return t?.trade === "power" && !t.knx?.provides;
  });
}
