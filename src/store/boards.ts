/**
 * Befehle für Verteiler und Reiheneinbaugeräte (design.md M4 „Verteiler platzieren“,
 * „Belegungsansicht“, „Verteilerhierarchie und Zuleitung“). Kaskaden beim Löschen erledigt
 * normalizeAfterCommand. Prüfungen vorab mit `Checked`. Frei von React.
 */
import { boardDescendants, boardDevices, fitError, type Placement } from "../geometry/boards";
import { suggestPath } from "../geometry/cables";
import type { Board, BoardField, Device, Project } from "../model/types";
import type { Checked } from "./catalog";
import type { Command } from "./history";

export function addBoard(board: Board): Command {
  return {
    label: "Verteiler anlegen",
    run(draft) {
      draft.boards.push(structuredClone(board));
    },
  };
}

export function moveBoard(id: string, placement: Board["placement"]): Command {
  return {
    label: "Verteiler verschieben",
    run(draft) {
      const b = draft.boards.find((x) => x.id === id);
      if (b) b.placement = { ...placement };
    },
  };
}

export type BoardEdit = Partial<
  Pick<Board, "label" | "kind" | "mounting" | "widthMm" | "heightMm" | "depthMm" | "placement">
>;

export function editBoard(id: string, edit: BoardEdit, label = "Verteiler ändern"): Command {
  return {
    label,
    run(draft) {
      const b = draft.boards.find((x) => x.id === id);
      if (!b) return;
      Object.assign(b, structuredClone(edit));
      // Zählerschränke haben keinen übergeordneten Verteiler
      if (b.kind === "meter-cabinet") {
        delete b.parentBoardId;
        if (b.feedCableId) draft.cables = draft.cables.filter((c) => c.id !== b.feedCableId);
        delete b.feedCableId;
      }
    },
  };
}

/** „Felder ändern“: ein Feld mit Geräten kann nicht gelöscht werden. */
export function setBoardFields(project: Project, id: string, fields: BoardField[]): Checked {
  const board = project.boards.find((b) => b.id === id);
  if (!board) return { ok: false, error: "Verteiler nicht gefunden" };
  const keep = new Set(fields.map((f) => f.id));
  for (const f of board.fields) {
    if (keep.has(f.id)) continue;
    const n = boardDevices(project, id).filter(
      (d) => d.placement.kind === "board" && d.placement.fieldId === f.id,
    ).length;
    if (n > 0) return { ok: false, error: `Feld enthält ${n} ${n === 1 ? "Gerät" : "Geräte"}` };
  }
  if (
    fields.some(
      (f) =>
        !Number.isInteger(f.rows) || f.rows < 0 || !Number.isInteger(f.tePerRow) || f.tePerRow < 0,
    )
  )
    return { ok: false, error: "Reihen und TE sind ganze Zahlen ≥ 0" };
  return {
    ok: true,
    command: {
      label: "Felder ändern",
      run(draft) {
        const b = draft.boards.find((x) => x.id === id);
        if (b) b.fields = structuredClone(fields);
      },
    },
  };
}

export function deleteBoards(ids: readonly string[]): Command {
  const set = new Set(ids);
  return {
    label: "Verteiler löschen",
    run(draft) {
      draft.boards = draft.boards.filter((b) => !set.has(b.id));
    },
  };
}

/** Was beim Löschen dieser Verteiler mitgelöscht wird (für die Bestätigung). */
export function boardCascade(project: Project, ids: readonly string[]) {
  const set = new Set(ids);
  return {
    devices: project.devices.filter(
      (d) => d.placement.kind === "board" && set.has(d.placement.boardId),
    ).length,
    circuits: project.circuits.filter((c) => set.has(c.boardId)).length,
    cables: project.cables.filter(
      (c) => set.has(c.from.boardId ?? "") || set.has(c.to.boardId ?? ""),
    ).length,
  };
}

/** Verteiler auf einer Wand (für die Bestätigung beim Löschen von Wand oder Geschoss). */
export const boardsOnWalls = (project: Project, wallIds: readonly string[]) =>
  project.boards
    .filter((b) => wallIds.includes(b.placement.surface.split(":")[1]!))
    .map((b) => b.id);

/** „Gerät einsetzen“ mit Platzprüfung. */
export function insertBoardDevice(
  project: Project,
  boardId: string,
  typeId: string,
  at: Placement,
  id: string,
  label?: string,
): Checked {
  const board = project.boards.find((b) => b.id === boardId);
  const type = project.catalog.deviceTypes.find((t) => t.id === typeId);
  if (!board || !type) return { ok: false, error: "Verteiler oder Gerätetyp nicht gefunden" };
  const error = fitError(project, board, type, at);
  if (error) return { ok: false, error };
  const device: Device = {
    id,
    label: label ?? type.name,
    typeId,
    status: "planned",
    storeyId: board.storeyId,
    placement: { kind: "board", boardId, ...at },
  };
  return {
    ok: true,
    command: {
      label: "Gerät einsetzen",
      run(draft) {
        draft.devices.push(structuredClone(device));
      },
    },
  };
}

/** „Gerät umsetzen“ (auch in ein anderes Feld desselben Verteilers) mit Platzprüfung. */
export function moveBoardDevice(project: Project, deviceId: string, at: Placement): Checked {
  const device = project.devices.find((d) => d.id === deviceId);
  if (!device || device.placement.kind !== "board")
    return { ok: false, error: "Reiheneinbaugerät nicht gefunden" };
  const board = project.boards.find(
    (b) => b.id === (device.placement as { boardId: string }).boardId,
  );
  const type = project.catalog.deviceTypes.find((t) => t.id === device.typeId);
  if (!board || !type) return { ok: false, error: "Verteiler oder Gerätetyp nicht gefunden" };
  const error = fitError(project, board, type, at, deviceId);
  if (error) return { ok: false, error };
  return {
    ok: true,
    command: {
      label: "Gerät umsetzen",
      run(draft) {
        const d = draft.devices.find((x) => x.id === deviceId);
        if (d && d.placement.kind === "board") Object.assign(d.placement, at);
      },
    },
  };
}

/**
 * „Verteiler zuordnen“ (design.md M4 „Verteilerhierarchie und Zuleitung“): setzt parentBoardId und
 * legt die Zuleitung an bzw. ändert sie; `parentId` null löscht Zuordnung und Zuleitung.
 */
export function assignParentBoard(
  project: Project,
  boardId: string,
  parentId: string | null,
  lineTypeId: string | undefined,
  newCableId: string,
): Checked {
  const board = project.boards.find((b) => b.id === boardId);
  if (!board) return { ok: false, error: "Verteiler nicht gefunden" };
  if (parentId !== null) {
    if (board.kind === "meter-cabinet")
      return { ok: false, error: "Ein Zählerschrank hat keinen übergeordneten Verteiler" };
    if (parentId === boardId || boardDescendants(project, boardId).has(parentId))
      return { ok: false, error: "Ein Verteiler kann nicht unter sich selbst hängen" };
    if (!project.boards.some((b) => b.id === parentId))
      return { ok: false, error: "Verteiler nicht gefunden" };
    const type = project.catalog.lineTypes.find((t) => t.id === lineTypeId);
    if (!type || type.trade !== "power")
      return { ok: false, error: "Zuleitung braucht einen Leitungstyp des Gewerks Strom" };
  }
  const existing = project.cables.find((c) => c.id === board.feedCableId);
  const path = parentId === null ? [] : suggestPath(project, { boardId: parentId }, { boardId });
  return {
    ok: true,
    command: {
      label: "Verteiler zuordnen",
      run(draft) {
        const b = draft.boards.find((x) => x.id === boardId);
        if (!b) return;
        if (parentId === null) {
          delete b.parentBoardId;
          if (b.feedCableId) draft.cables = draft.cables.filter((c) => c.id !== b.feedCableId);
          delete b.feedCableId;
          return;
        }
        b.parentBoardId = parentId;
        const c = existing ? draft.cables.find((x) => x.id === existing.id) : undefined;
        if (c) {
          c.from = { boardId: parentId };
          c.to = { boardId };
          c.lineTypeId = lineTypeId!;
          c.path = path;
        } else {
          draft.cables.push({
            id: newCableId,
            label: `Zuleitung ${board.label}`,
            lineTypeId: lineTypeId!,
            status: "planned",
            from: { boardId: parentId },
            to: { boardId },
            path,
          });
          b.feedCableId = newCableId;
        }
      },
    },
  };
}
