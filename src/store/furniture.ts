/** Befehle für Möbel (design.md M2 „Möbel“). Frei von React. */
import { roundDeg } from "../model/rounding";
import type { Furniture } from "../model/types";
import type { Command } from "./history";

export function addFurniture(furniture: Furniture): Command {
  return {
    label: "Möbel setzen",
    run(draft) {
      draft.furniture.push(structuredClone(furniture));
    },
  };
}

export type FurnitureEdit = Partial<
  Pick<
    Furniture,
    "typeId" | "x" | "y" | "rotationDeg" | "widthMm" | "depthMm" | "heightMm" | "elevationMm"
  >
>;

export function editFurniture(id: string, edit: FurnitureEdit, label = "Möbel ändern"): Command {
  return {
    label,
    run(draft) {
      const f = draft.furniture.find((x) => x.id === id);
      if (f) Object.assign(f, edit);
    },
  };
}

export function moveFurniture(
  id: string,
  pose: Pick<Furniture, "x" | "y" | "rotationDeg">,
): Command {
  return editFurniture(id, pose, "Möbel verschieben");
}

/** Dreht um 90° gegen den Uhrzeigersinn um die Mitte (Taste R). */
export function rotateFurniture90(id: string, current: number): Command {
  return editFurniture(id, { rotationDeg: roundDeg((((current + 90) % 360) + 360) % 360) });
}

export function deleteFurniture(ids: readonly string[]): Command {
  const set = new Set(ids);
  return {
    label: "Möbel löschen",
    run(draft) {
      draft.furniture = draft.furniture.filter((f) => !set.has(f.id));
    },
  };
}
