/**
 * KNX-Planung (design.md M4 „KNX“): Verbraucher, Verteiler eines Verbrauchers, Kanalbedarf,
 * Aktorvorschlag, Platzsuche beim Übernehmen, automatische Kanalzuordnung, Linienteilnehmer.
 * Abgeleitet, nichts gespeichert. Frei von React.
 */
import { boardDevices, deviceTeWidth, findFreeSlot, type Placement } from "./boards";
import { deviceRoom, feedingBoards, lineTypeTrade } from "./circuits";
import { KNX_FUNCTIONS } from "../model/schema";
import type { Board, Device, DeviceType, KnxLine, Project } from "../model/types";

export type KnxFunction = (typeof KNX_FUNCTIONS)[number];

export const KNX_FUNCTION_LABELS: Record<KnxFunction, string> = {
  switch: "Schalten",
  dim: "Dimmen",
  blind: "Jalousie",
  heating: "Heizung",
  "binary-input": "Binäreingang",
};

/** Kürzel der Aktorbezeichnung je Funktion (design.md M4 „Vorschlag übernehmen“). */
export const KNX_PREFIX: Record<KnxFunction, string> = {
  switch: "SA",
  dim: "DA",
  blind: "JA",
  heating: "HA",
  "binary-input": "BE",
};

const typeOf = (project: Project, d: Device) =>
  project.catalog.deviceTypes.find((t) => t.id === d.typeId);

/** Verbraucher: Typ mit `knx.consumes`, nicht in einem Verteiler. */
export function consumerFunction(project: Project, d: Device): KnxFunction | undefined {
  if (d.placement.kind === "board") return undefined;
  return typeOf(project, d)?.knx?.consumes;
}

export const knxConsumers = (project: Project): Device[] =>
  project.devices.filter((d) => consumerFunction(project, d) !== undefined);

/** Aktor: Reiheneinbaugerät mit `knx.provides`. */
export function actuatorProvides(project: Project, d: Device) {
  if (d.placement.kind !== "board") return undefined;
  return typeOf(project, d)?.knx?.provides;
}

/** Verteiler eines Verbrauchers: genau ein speisender Verteiler, sonst der seines Stromkreises. */
export function consumerBoardId(project: Project, d: Device): string | null {
  const fed = feedingBoards(project, d.id);
  if (fed.length === 1) return fed[0]!;
  const circuit = project.circuits.find((c) => c.id === d.circuitId);
  if (circuit && project.boards.some((b) => b.id === circuit.boardId)) return circuit.boardId;
  return null;
}

/** Natürliche Sortierung: „JA2“ vor „JA10“. */
export const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, "de", { numeric: true, sensitivity: "base" });

/** Aktoren eines Verteilers (optional einer Funktion), nach Bezeichnung (natürlich), dann ID. */
export function boardActuators(project: Project, boardId: string, fn?: KnxFunction): Device[] {
  return boardDevices(project, boardId)
    .filter((d) => {
      const p = actuatorProvides(project, d);
      return p !== undefined && (fn === undefined || p.function === fn);
    })
    .sort((a, b) => naturalCompare(a.label, b.label) || (a.id < b.id ? -1 : 1));
}

export interface Suggestion {
  /** Typen in Reihenfolge (nach ID sortiert, mehrfach möglich) */
  types: DeviceType[];
  te: number;
  channels: number;
}

/**
 * Mehrfachmenge von Aktortypen mit Kanalsumme ≥ `missing`: möglichst wenig TE, dann wenig Geräte,
 * dann lexikografisch kleinste Typ-ID-Folge (design.md M4 „Aktorvorschlag“). null ohne Typ.
 */
export function suggestActuators(
  types: readonly DeviceType[],
  fn: KnxFunction,
  missing: number,
): Suggestion | null {
  const candidates = types
    .filter((t) => t.knx?.provides?.function === fn && t.knx.provides.channels > 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (candidates.length === 0) return null;
  if (missing <= 0) return { types: [], te: 0, channels: 0 };
  const maxCh = Math.max(...candidates.map((t) => t.knx!.provides!.channels));
  const limit = missing + maxCh;
  interface Best {
    te: number;
    count: number;
    ids: string[];
  }
  const better = (a: Best, b: Best | undefined) => {
    if (!b) return true;
    if (a.te !== b.te) return a.te < b.te;
    if (a.count !== b.count) return a.count < b.count;
    for (let i = 0; i < Math.min(a.ids.length, b.ids.length); i++)
      if (a.ids[i] !== b.ids[i]) return a.ids[i]! < b.ids[i]!;
    return a.ids.length < b.ids.length;
  };
  // dp[c]: beste Menge mit genau c Kanälen
  const dp: (Best | undefined)[] = new Array(limit + 1).fill(undefined);
  dp[0] = { te: 0, count: 0, ids: [] };
  for (let c = 1; c <= limit; c++) {
    for (const t of candidates) {
      const ch = t.knx!.provides!.channels;
      const prev = c - ch >= 0 ? dp[c - ch] : undefined;
      if (!prev) continue;
      const ids = [...prev.ids, t.id].sort();
      const cand = { te: prev.te + deviceTeWidth(t), count: prev.count + 1, ids };
      if (better(cand, dp[c])) dp[c] = cand;
    }
  }
  let best: Best | undefined;
  let bestCh = 0;
  for (let c = missing; c <= limit; c++)
    if (dp[c] && better(dp[c]!, best)) {
      best = dp[c];
      bestCh = c;
    }
  if (!best) return null;
  const byId = new Map(candidates.map((t) => [t.id, t]));
  return { types: best.ids.map((id) => byId.get(id)!), te: best.te, channels: bestCh };
}

export interface KnxRow {
  fn: KnxFunction;
  demand: number;
  required: number;
  provided: number;
  missing: number;
  /** null: kein Aktortyp im Katalog */
  suggestion: Suggestion | null;
}

/** Tabelle „KNX“ eines Verteilers: Funktionen mit Bedarf oder vorhandenen Kanälen. */
export function boardKnx(project: Project, boardId: string): KnxRow[] {
  const reserve = project.settings.actuatorReservePercent;
  const rows: KnxRow[] = [];
  for (const fn of KNX_FUNCTIONS) {
    const demand = knxConsumers(project).filter(
      (d) => consumerFunction(project, d) === fn && consumerBoardId(project, d) === boardId,
    ).length;
    const provided = boardActuators(project, boardId, fn).reduce(
      (s, d) => s + (actuatorProvides(project, d)?.channels ?? 0),
      0,
    );
    if (demand === 0 && provided === 0) continue;
    const required = Math.ceil(demand * (1 + reserve / 100) - 1e-9);
    const missing = Math.max(0, required - provided);
    rows.push({
      fn,
      demand,
      required,
      provided,
      missing,
      suggestion: suggestActuators(project.catalog.deviceTypes, fn, missing),
    });
  }
  return rows;
}

/** TE des Aktorvorschlags über alle Funktionen (vorgemerkt). */
export const actuatorEarmarkTe = (project: Project, boardId: string) =>
  boardKnx(project, boardId).reduce((s, r) => s + (r.suggestion?.te ?? 0), 0);

export interface PlannedActuator {
  typeId: string;
  label: string;
  placement: Placement;
}

/**
 * Plätze und Bezeichnungen für den Vorschlag (design.md M4 „Vorschlag übernehmen“); bei zu wenig
 * Platz die Anzahl fehlender TE.
 */
export function planSuggestion(
  project: Project,
  board: Board,
): { ok: true; actuators: PlannedActuator[] } | { ok: false; missingTe: number } {
  const taken: (Placement & { width: number })[] = [];
  const actuators: PlannedActuator[] = [];
  let missingTe = 0;
  const used = new Map<KnxFunction, Set<number>>();
  const nextLabel = (fn: KnxFunction) => {
    const prefix = KNX_PREFIX[fn];
    let set = used.get(fn);
    if (!set) {
      set = new Set(
        boardDevices(project, board.id)
          .map((d) => new RegExp(`^${prefix}(\\d+)$`).exec(d.label)?.[1])
          .filter((n): n is string => n !== undefined)
          .map(Number),
      );
      used.set(fn, set);
    }
    let n = 1;
    while (set.has(n)) n++;
    set.add(n);
    return `${prefix}${n}`;
  };
  for (const row of boardKnx(project, board.id)) {
    for (const type of row.suggestion?.types ?? []) {
      const width = deviceTeWidth(type);
      const at = findFreeSlot(project, board, width, taken);
      if (!at) {
        missingTe += width;
        continue;
      }
      taken.push({ ...at, width });
      actuators.push({ typeId: type.id, label: nextLabel(row.fn), placement: at });
    }
  }
  return missingTe > 0 ? { ok: false, missingTe } : { ok: true, actuators };
}

/** „JA2.C“: Aktorbezeichnung und Kanalbuchstabe (1 = A). */
export function channelLabel(actuatorLabel: string, channel: number): string {
  let n = channel;
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `${actuatorLabel}.${s}`;
}

/** Freie Kanäle passender Funktion für einen Verbraucher (in Aktoren seines Verteilers). */
export function freeChannelsFor(project: Project, consumer: Device) {
  const fn = consumerFunction(project, consumer);
  const boardId = consumerBoardId(project, consumer);
  if (!fn || !boardId) return [];
  const taken = new Set(project.knxAssignments.map((a) => `${a.actuatorDeviceId}#${a.channel}`));
  const out: { actuatorDeviceId: string; channel: number; label: string }[] = [];
  for (const a of boardActuators(project, boardId, fn)) {
    const n = actuatorProvides(project, a)!.channels;
    for (let ch = 1; ch <= n; ch++)
      if (!taken.has(`${a.id}#${ch}`))
        out.push({ actuatorDeviceId: a.id, channel: ch, label: channelLabel(a.label, ch) });
  }
  return out;
}

/**
 * Automatische Zuordnung (design.md M4 „Automatisch zuordnen“): Verbraucher ohne Kanal, nach
 * Raumname (ohne Raum zuletzt), Bezeichnung, ID; freie Kanäle in Aktorreihenfolge.
 */
export function autoAssignments(project: Project, boardId: string) {
  const assigned = new Set(project.knxAssignments.map((a) => a.consumerDeviceId));
  const roomName = (d: Device) => deviceRoom(project, d)?.name;
  const consumers = knxConsumers(project)
    .filter((d) => !assigned.has(d.id) && consumerBoardId(project, d) === boardId)
    .sort((a, b) => {
      const ra = roomName(a);
      const rb = roomName(b);
      if (ra === undefined || rb === undefined) {
        if (ra !== rb) return ra === undefined ? 1 : -1;
      } else if (ra !== rb) return ra.localeCompare(rb, "de");
      return a.label.localeCompare(b.label, "de") || (a.id < b.id ? -1 : 1);
    });
  const taken = new Set(project.knxAssignments.map((a) => `${a.actuatorDeviceId}#${a.channel}`));
  const result: { actuatorDeviceId: string; channel: number; consumerDeviceId: string }[] = [];
  for (const c of consumers) {
    const fn = consumerFunction(project, c)!;
    outer: for (const a of boardActuators(project, boardId, fn)) {
      const n = actuatorProvides(project, a)!.channels;
      for (let ch = 1; ch <= n; ch++) {
        const key = `${a.id}#${ch}`;
        if (taken.has(key)) continue;
        taken.add(key);
        result.push({ actuatorDeviceId: a.id, channel: ch, consumerDeviceId: c.id });
        break outer;
      }
    }
  }
  return result;
}

/** Busteilnehmer: Typ des Gewerks KNX oder schließt KNX an. */
export function isBusParticipant(project: Project, d: Device): boolean {
  const t = typeOf(project, d);
  return !!t && (t.trade === "knx" || t.connects.includes("knx"));
}

/**
 * Busteilnehmer, die vom Startverteiler der Linie über KNX-Leitungen erreichbar sind; dazu die
 * Reiheneinbau-Busteilnehmer im Verteiler; durch weitere Verteiler geht die Suche nicht.
 */
export function reachableParticipants(project: Project, line: KnxLine): string[] {
  if (!line.boardId) return [];
  const start = line.boardId;
  const knx = project.cables.filter((c) => lineTypeTrade(project, c) === "knx");
  const found = new Set<string>(
    boardDevices(project, start)
      .filter((d) => isBusParticipant(project, d))
      .map((d) => d.id),
  );
  const seen = new Set<string>();
  const queue: { device?: string; board?: string }[] = [{ board: start }];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const c of knx) {
      const ends = [c.from, c.to];
      const here = ends.some((e) =>
        at.board !== undefined ? e.boardId === at.board : e.deviceId === at.device,
      );
      if (!here) continue;
      for (const e of ends) {
        if (e.deviceId === undefined || seen.has(e.deviceId)) continue;
        seen.add(e.deviceId);
        const d = project.devices.find((x) => x.id === e.deviceId);
        if (!d) continue;
        if (isBusParticipant(project, d)) found.add(d.id);
        queue.push({ device: d.id });
      }
    }
  }
  return [...found].sort();
}

export const lineParticipantCount = (project: Project, lineId: string) =>
  project.devices.filter((d) => d.knxLineId === lineId).length;
