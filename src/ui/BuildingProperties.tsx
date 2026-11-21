import { finishedArea } from "../geometry/rooms";
import { moveEndpoint, moveParallel, setWallLength } from "../geometry/wall-edit";
import { distance } from "../geometry/vec";
import { OPENING_LABELS } from "../geometry/openings";
import { formatArea, formatLength } from "../model/units";
import type { Opening, Project, Room, Wall } from "../model/types";
import {
  applyWallEdit,
  deleteRoom,
  deleteSlope,
  deleteWall,
  editOpening,
  editRoom,
  editSlope,
  editWall,
  wallGeoms,
} from "../store/building";
import { deleteOpening } from "../store/commands";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { DegField, MmField, OptionalMmField, TextField } from "./fields";
import { allRoomStatuses } from "../rules/building";

export function WallProperties({
  wall,
  project,
  store,
  onMessage,
}: {
  wall: Wall;
  project: Project;
  store: ProjectStore;
  onMessage?(text: string): void;
}) {
  const storey = project.storeys.find((s) => s.id === wall.storeyId);
  const geoms = () => wallGeoms(store.getState().project, wall.storeyId);
  const apply = (result: ReturnType<typeof moveParallel>, label: string) => {
    store.execute(applyWallEdit(wall.storeyId, result, label));
    if (result.released.length > 0) onMessage?.("T-Anschluss gelöst.");
  };
  const length = distance(wall.start, wall.end);
  const point = (end: "start" | "end", axis: "x" | "y", v: number) =>
    apply(moveEndpoint(geoms(), wall.id, end, { ...wall[end], [axis]: v }), "Endpunkt verschieben");
  return (
    <div>
      <p className="hint">Länge {formatLength(length)}</p>
      <MmField
        label="Länge"
        min={1}
        value={Math.round(length)}
        onCommit={(v) => apply(setWallLength(geoms(), wall.id, v), "Wandlänge ändern")}
      />
      <MmField
        label="Dicke"
        min={1}
        value={wall.thicknessMm}
        onCommit={(value) => store.execute(editWall(wall.id, { field: "thicknessMm", value }))}
      />
      <div className="field">
        <label htmlFor={`kind-${wall.id}`}>Art</label>
        <select
          id={`kind-${wall.id}`}
          value={wall.kind}
          onChange={(e) =>
            store.execute(
              editWall(wall.id, { field: "kind", value: e.target.value as Wall["kind"] }),
            )
          }
        >
          <option value="interior">Innenwand</option>
          <option value="exterior">Außenwand</option>
        </select>
      </div>
      <OptionalMmField
        label="Höhe"
        min={1}
        value={wall.rawHeightMm}
        fallback={storey?.rawHeightMm ?? 0}
        onCommit={(value) => store.execute(editWall(wall.id, { field: "rawHeightMm", value }))}
      />
      <h3>Achse</h3>
      <MmField label="Anfang x" value={wall.start.x} onCommit={(v) => point("start", "x", v)} />
      <MmField label="Anfang y" value={wall.start.y} onCommit={(v) => point("start", "y", v)} />
      <MmField label="Ende x" value={wall.end.x} onCommit={(v) => point("end", "x", v)} />
      <MmField label="Ende y" value={wall.end.y} onCommit={(v) => point("end", "y", v)} />
      <MmField
        label="Parallel verschieben um (positiv nach links)"
        value={0}
        resetAfterCommit
        onCommit={(v) => v !== 0 && apply(moveParallel(geoms(), wall.id, v), "Wand verschieben")}
      />
      {wall.kind === "exterior" && (
        <div className="field">
          <label htmlFor={`outside-${wall.id}`}>Außenseite, falls nicht eindeutig</label>
          <select
            id={`outside-${wall.id}`}
            value={wall.outsideSide ?? "L"}
            onChange={(e) =>
              store.execute(
                editWall(wall.id, {
                  field: "outsideSide",
                  value: e.target.value === "L" ? undefined : "R",
                }),
              )
            }
          >
            <option value="L">links</option>
            <option value="R">rechts</option>
          </select>
        </div>
      )}
      <button type="button" className="danger" onClick={() => store.execute(deleteWall(wall.id))}>
        Wand löschen
      </button>
    </div>
  );
}

export function RoomProperties({
  room,
  project,
  store,
  view,
}: {
  room: Room;
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const storey = project.storeys.find((s) => s.id === room.storeyId);
  const defaults = storey?.defaults ?? { floorBuildupMm: 0, plasterMm: 0, suspendedMm: 0 };
  const plaster = room.plasterMm ?? defaults.plasterMm;
  const status = allRoomStatuses(project).get(room.id);
  return (
    <div>
      <TextField
        label="Name"
        value={room.name}
        onCommit={(value) => store.execute(editRoom(room.id, { field: "name", value }))}
      />
      <p aria-label="Fläche">Fläche (fertig): {formatArea(finishedArea(room.polygon, plaster))}</p>
      {status && status.status !== "ok" && (
        <p role="alert" className="plan__message">
          {status.status === "merged"
            ? "Raum mit einem anderen Raum verschmolzen."
            : "Raum nicht geschlossen."}
        </p>
      )}
      <OptionalMmField
        label="Rohbauhöhe"
        min={1}
        value={room.rawHeightMm}
        fallback={storey?.rawHeightMm ?? 0}
        onCommit={(value) => store.execute(editRoom(room.id, { field: "rawHeightMm", value }))}
      />
      <OptionalMmField
        label="Fußbodenaufbau"
        min={0}
        value={room.floorBuildupMm}
        fallback={defaults.floorBuildupMm}
        onCommit={(value) => store.execute(editRoom(room.id, { field: "floorBuildupMm", value }))}
      />
      <OptionalMmField
        label="Putzstärke"
        min={0}
        value={room.plasterMm}
        fallback={defaults.plasterMm}
        onCommit={(value) => store.execute(editRoom(room.id, { field: "plasterMm", value }))}
      />
      <OptionalMmField
        label="Abhängung"
        min={0}
        value={room.suspendedMm}
        fallback={defaults.suspendedMm}
        onCommit={(value) => store.execute(editRoom(room.id, { field: "suspendedMm", value }))}
      />
      <button type="button" onClick={() => view.setPlanTool("redetect-room", room.id)}>
        Raum neu erkennen
      </button>
      <h3>Dachschrägen</h3>
      {(room.slopes ?? []).map((s, i) => (
        <fieldset key={s.id} aria-label={`Schräge ${i + 1}`} className="slope">
          <legend>Schräge {i + 1}</legend>
          <MmField
            label="Höhe an der Grundlinie"
            value={s.heightAtBaseMm}
            onCommit={(value) =>
              store.execute(editSlope(room.id, s.id, { field: "heightAtBaseMm", value }))
            }
          />
          <DegField
            label="Neigung"
            value={s.angleDeg}
            onCommit={(value) =>
              value > 0 &&
              value < 90 &&
              store.execute(editSlope(room.id, s.id, { field: "angleDeg", value }))
            }
          />
          <button type="button" onClick={() => store.execute(deleteSlope(room.id, s.id))}>
            Schräge löschen
          </button>
        </fieldset>
      ))}
      <button type="button" onClick={() => view.setPlanTool("slope", room.id)}>
        Schräge hinzufügen
      </button>
      <button type="button" className="danger" onClick={() => store.execute(deleteRoom(room.id))}>
        Raum löschen
      </button>
    </div>
  );
}

const SHUTTER_LABELS = {
  none: "keiner",
  inside: "innen",
  outside: "außen (Vorbau)",
  top: "Aufsatz",
} as const;

export function OpeningProperties({ opening, store }: { opening: Opening; store: ProjectStore }) {
  const edit = (e: Parameters<typeof editOpening>[1]) => store.execute(editOpening(opening.id, e));
  return (
    <div>
      <div className="field">
        <label htmlFor={`okind-${opening.id}`}>Art</label>
        <select
          id={`okind-${opening.id}`}
          value={opening.kind}
          onChange={(e) => edit({ field: "kind", value: e.target.value as Opening["kind"] })}
        >
          {(Object.keys(OPENING_LABELS) as Opening["kind"][]).map((k) => (
            <option key={k} value={k}>
              {OPENING_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <p className="hint">Rohbaumaße; Brüstung ab Oberkante Rohfußboden.</p>
      <MmField
        label="Abstand vom Wandanfang"
        value={opening.offsetMm}
        onCommit={(value) => edit({ field: "offsetMm", value })}
      />
      <MmField
        label="Breite"
        min={1}
        value={opening.widthMm}
        onCommit={(value) => edit({ field: "widthMm", value })}
      />
      <MmField
        label="Höhe"
        min={1}
        value={opening.heightMm}
        onCommit={(value) => edit({ field: "heightMm", value })}
      />
      <MmField
        label="Brüstung"
        value={opening.sillMm}
        onCommit={(value) => edit({ field: "sillMm", value })}
      />
      <div className="field">
        <label htmlFor={`shutter-${opening.id}`}>Rollladenkasten</label>
        <select
          id={`shutter-${opening.id}`}
          value={opening.shutterBox?.position ?? "none"}
          onChange={(e) => {
            const v = e.target.value as keyof typeof SHUTTER_LABELS;
            edit({
              field: "shutterBox",
              value:
                v === "none"
                  ? undefined
                  : { position: v, heightMm: opening.shutterBox?.heightMm ?? 250 },
            });
          }}
        >
          {(Object.keys(SHUTTER_LABELS) as (keyof typeof SHUTTER_LABELS)[]).map((k) => (
            <option key={k} value={k}>
              {SHUTTER_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      {opening.shutterBox && (
        <MmField
          label="Höhe Rollladenkasten"
          min={1}
          value={opening.shutterBox.heightMm}
          onCommit={(heightMm) =>
            edit({ field: "shutterBox", value: { ...opening.shutterBox!, heightMm } })
          }
        />
      )}
      <button
        type="button"
        className="danger"
        onClick={() => store.execute(deleteOpening(opening.id))}
      >
        Öffnung löschen
      </button>
    </div>
  );
}
