/** Benannte Befehle mit deutschem Label für das Undo-Menü. */
import type { Storey, Underlay } from "../model/types";
import type { Command } from "./history";

export function deleteOpening(id: string): Command {
  return {
    label: "Öffnung löschen",
    run(draft) {
      draft.openings = draft.openings.filter((o) => o.id !== id);
    },
  };
}

export function setProjectName(name: string): Command {
  return {
    label: "Projekt umbenennen",
    run(draft) {
      draft.name = name;
    },
  };
}

export function setNorthDeg(deg: number): Command {
  return {
    label: "Nordrichtung ändern",
    run(draft) {
      draft.settings.northDeg = deg;
    },
  };
}

export function addStorey(storey: Storey): Command {
  return {
    label: "Geschoss anlegen",
    run(draft) {
      draft.storeys.push(storey);
    },
  };
}

export type StoreyEdit =
  | { field: "name"; value: string }
  | { field: "elevationMm" | "rawHeightMm"; value: number }
  | { field: "floorBuildupMm" | "plasterMm" | "suspendedMm"; value: number };

const STOREY_EDIT_LABELS: Record<StoreyEdit["field"], string> = {
  name: "Geschoss umbenennen",
  elevationMm: "Höhenlage ändern",
  rawHeightMm: "Rohbauhöhe ändern",
  floorBuildupMm: "Fußbodenaufbau ändern",
  plasterMm: "Putzstärke ändern",
  suspendedMm: "Abhängung ändern",
};

/** Ändert ein Feld eines Geschosses; der Slug bleibt beim Umbenennen gleich. */
export function editStorey(id: string, edit: StoreyEdit): Command {
  return {
    label: STOREY_EDIT_LABELS[edit.field],
    run(draft) {
      const storey = draft.storeys.find((s) => s.id === id);
      if (!storey) return;
      if (edit.field === "name") storey.name = edit.value;
      else if (edit.field === "elevationMm" || edit.field === "rawHeightMm")
        storey[edit.field] = edit.value;
      else storey.defaults[edit.field] = edit.value;
    },
  };
}

/** Löscht ein Geschoss mit allen Wänden, Räumen und Öffnungen in einem Schritt. */
export function deleteStorey(id: string): Command {
  return {
    label: "Geschoss löschen",
    run(draft) {
      draft.storeys = draft.storeys.filter((s) => s.id !== id);
      draft.walls = draft.walls.filter((w) => w.storeyId !== id);
      draft.rooms = draft.rooms.filter((r) => r.storeyId !== id);
      draft.openings = draft.openings.filter((o) => o.storeyId !== id);
    },
  };
}

/** Setzt oder entfernt den Planhintergrund eines Geschosses. */
export function setUnderlay(
  storeyId: string,
  underlay: Underlay | undefined,
  label: string,
): Command {
  return {
    label,
    run(draft) {
      const storey = draft.storeys.find((s) => s.id === storeyId);
      if (!storey) return;
      if (underlay) storey.underlay = underlay;
      else delete storey.underlay;
    },
  };
}
