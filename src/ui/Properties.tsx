import { useStore } from "zustand";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import type { Api } from "../io/api";
import { StoreyProperties } from "./StoreyProperties";

const KIND_LABELS = {
  storey: "Geschoss",
  wall: "Wand",
  room: "Raum",
  opening: "Öffnung",
  slope: "Schräge",
} as const;

/** Eigenschaften der Auswahl; die Bearbeitung je Objekttyp folgt in den Abschnitten 5 und 6. */
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
  } else if (selection) {
    body = (
      <p>
        {KIND_LABELS[selection.kind]} {selection.id}
      </p>
    );
  }
  return (
    <aside aria-label="Eigenschaften" className="properties">
      <h2>{selection ? KIND_LABELS[selection.kind] : "Eigenschaften"}</h2>
      {body}
    </aside>
  );
}
