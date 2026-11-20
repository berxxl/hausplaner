/** Benannte Befehle mit deutschem Label für das Undo-Menü. */
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
