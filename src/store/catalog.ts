/**
 * Befehle und Prüfungen für den Katalog (design.md M2 „Katalog“). Ablehnungen werden vor dem
 * Befehl geprüft, damit kein abgelehnter Schritt in der Undo-Historie landet. Frei von React.
 */
import { deviceMounting } from "../model/devices";
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import type { DeviceType, FurnitureType, LineType, Mounting, Project } from "../model/types";
import type { Command } from "./history";

export type CatalogKind = "deviceTypes" | "lineTypes" | "furnitureTypes";
export type CatalogEntry<K extends CatalogKind> = K extends "deviceTypes"
  ? DeviceType
  : K extends "lineTypes"
    ? LineType
    : FurnitureType;

export const MOUNTING_LABELS: Record<Mounting, string> = {
  wall: "Wand",
  ceiling: "Decke",
  floor: "Boden",
  "din-rail": "Hutschiene",
  free: "frei",
};

/** Anzahl der Objekte, die einen Typ verwenden (Geräte, Möbel, Leitungen). */
export function typeUsage(project: Project, kind: CatalogKind, id: string): number {
  if (kind === "deviceTypes") return project.devices.filter((d) => d.typeId === id).length;
  if (kind === "furnitureTypes") return project.furniture.filter((f) => f.typeId === id).length;
  return project.cables.filter((c) => c.lineTypeId === id).length;
}

/** Geräte dieses Typs, die auf der gegebenen Montageart sitzen. */
export function mountingUsage(project: Project, typeId: string, mounting: Mounting): number {
  return project.devices.filter((d) => d.typeId === typeId && deviceMounting(d) === mounting)
    .length;
}

export type Checked = { ok: true; command: Command } | { ok: false; error: string };

export function addCatalogType<K extends CatalogKind>(kind: K, entry: CatalogEntry<K>): Command {
  return {
    label: "Typ anlegen",
    run(draft) {
      (draft.catalog[kind] as CatalogEntry<K>[]).push(entry);
    },
  };
}

/** Kopie mit neuer zufälliger ID und Namen „<Name> Kopie“. */
export function copyCatalogType<K extends CatalogKind>(
  project: Project,
  kind: K,
  id: string,
): { command: Command; id: string } | null {
  const source = (project.catalog[kind] as CatalogEntry<K>[]).find((t) => t.id === id);
  if (!source) return null;
  const copyId = newId(new Set(allIds(project)));
  const copy = { ...structuredClone(source), id: copyId, name: `${source.name} Kopie` };
  return {
    id: copyId,
    command: {
      label: "Typ kopieren",
      run(draft) {
        (draft.catalog[kind] as CatalogEntry<K>[]).push(copy);
      },
    },
  };
}

/** Ersetzt einen Typ; prüft Pflichtfelder und entfernte, noch verwendete Montagearten. */
export function updateCatalogType<K extends CatalogKind>(
  project: Project,
  kind: K,
  entry: CatalogEntry<K>,
): Checked {
  const list = project.catalog[kind] as CatalogEntry<K>[];
  const old = list.find((t) => t.id === entry.id);
  if (!old) return { ok: false, error: "Typ nicht gefunden" };
  if (entry.name.trim() === "") return { ok: false, error: "Name darf nicht leer sein" };
  if (kind === "deviceTypes") {
    const next = entry as DeviceType;
    if (next.mounting.length === 0)
      return { ok: false, error: "Mindestens eine Montageart ist nötig" };
    for (const m of (old as DeviceType).mounting) {
      if (next.mounting.includes(m)) continue;
      const n = mountingUsage(project, next.id, m);
      if (n > 0)
        return {
          ok: false,
          error: `Montageart ${MOUNTING_LABELS[m]} wird von ${n} ${n === 1 ? "Gerät" : "Geräten"} verwendet`,
        };
    }
  }
  return {
    ok: true,
    command: {
      label: "Typ ändern",
      run(draft) {
        const target = draft.catalog[kind] as CatalogEntry<K>[];
        const i = target.findIndex((t) => t.id === entry.id);
        if (i >= 0) target[i] = entry;
      },
    },
  };
}

/** Löschen nur, wenn der Typ nicht verwendet wird. */
export function deleteCatalogType(project: Project, kind: CatalogKind, id: string): Checked {
  const n = typeUsage(project, kind, id);
  if (n > 0) {
    const what =
      kind === "furnitureTypes"
        ? n === 1
          ? "Möbel"
          : "Möbeln"
        : kind === "lineTypes"
          ? n === 1
            ? "Leitung"
            : "Leitungen"
          : n === 1
            ? "Gerät"
            : "Geräten";
    return { ok: false, error: `Typ wird von ${n} ${what} verwendet` };
  }
  return {
    ok: true,
    command: {
      label: "Typ löschen",
      run(draft) {
        const list = draft.catalog[kind] as { id: string }[];
        const i = list.findIndex((t) => t.id === id);
        if (i >= 0) list.splice(i, 1);
      },
    },
  };
}
