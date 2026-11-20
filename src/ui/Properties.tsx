import { useStore } from "zustand";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";

const KIND_LABELS = {
  storey: "Geschoss",
  wall: "Wand",
  room: "Raum",
  opening: "Öffnung",
  slope: "Schräge",
} as const;

/** Eigenschaften der Auswahl; die Bearbeitung je Objekttyp folgt in den Abschnitten 5 und 6. */
export function Properties({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const selection = useStore(view, (s) => s.selection);
  const project = useStore(store, (s) => s.project);
  let body = <p>Nichts ausgewählt</p>;
  if (selection?.kind === "storey") {
    const storey = project.storeys.find((s) => s.id === selection.id);
    if (storey) {
      body = (
        <dl>
          <dt>Name</dt>
          <dd>{storey.name}</dd>
          <dt>Höhenlage</dt>
          <dd>{storey.elevationMm} mm</dd>
          <dt>Rohbauhöhe</dt>
          <dd>{storey.rawHeightMm} mm</dd>
        </dl>
      );
    }
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
