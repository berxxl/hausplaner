import { useStore } from "zustand";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import type { Api } from "../io/api";
import { StoreyProperties } from "./StoreyProperties";
import { DeviceProperties } from "./DeviceProperties";
import { FurnitureProperties } from "./FurnitureProperties";
import { OpeningProperties, RoomProperties, WallProperties } from "./BuildingProperties";

const KIND_LABELS = {
  storey: "Geschoss",
  wall: "Wand",
  room: "Raum",
  opening: "Öffnung",
  slope: "Schräge",
  device: "Gerät",
  furniture: "Möbel",
  "route-node": "Trassenknoten",
  "route-segment": "Trassensegment",
  cable: "Leitung",
} as const;

/** Eigenschaften der Auswahl. */
export function Properties({
  store,
  view,
  api,
}: {
  store: ProjectStore;
  view: ViewStore;
  api?: Pick<Api, "putPlan">;
}) {
  const selection = useStore(view, (s) => s.selection);
  const project = useStore(store, (s) => s.project);
  let body = <p>Nichts ausgewählt</p>;
  if (selection?.kind === "storey") {
    const storey = project.storeys.find((s) => s.id === selection.id);
    if (storey) body = <StoreyProperties storey={storey} store={store} api={api} />;
  } else if (selection?.kind === "wall") {
    const wall = project.walls.find((w) => w.id === selection.id);
    if (wall) body = <WallProperties key={wall.id} wall={wall} project={project} store={store} />;
  } else if (selection?.kind === "room") {
    const room = project.rooms.find((r) => r.id === selection.id);
    if (room)
      body = (
        <RoomProperties key={room.id} room={room} project={project} store={store} view={view} />
      );
  } else if (selection?.kind === "device") {
    body = (
      <DeviceProperties
        project={project}
        store={store}
        view={view}
        ids={selection.ids ?? [selection.id]}
      />
    );
  } else if (selection?.kind === "furniture") {
    const f = project.furniture.find((x) => x.id === selection.id);
    if (f)
      body = (
        <FurnitureProperties key={f.id} furniture={f} project={project} store={store} view={view} />
      );
  } else if (selection?.kind === "opening") {
    const opening = project.openings.find((o) => o.id === selection.id);
    if (opening) body = <OpeningProperties key={opening.id} opening={opening} store={store} />;
  }
  return (
    <aside aria-label="Eigenschaften" className="properties">
      <h2>{selection ? KIND_LABELS[selection.kind] : "Eigenschaften"}</h2>
      {body}
    </aside>
  );
}
