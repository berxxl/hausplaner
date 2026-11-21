import { useId } from "react";
import { roundDeg } from "../model/rounding";
import type { Furniture, Project } from "../model/types";
import {
  deleteFurniture,
  editFurniture,
  rotateFurniture90,
  type FurnitureEdit,
} from "../store/furniture";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { DegField, MmField } from "./fields";

/** Eigenschaften eines Möbels: Typ, Lage, Drehung und alle Maße (design.md M2 „Möbel“). */
export function FurnitureProperties({
  furniture: f,
  project,
  store,
  view,
}: {
  furniture: Furniture;
  project: Project;
  store: ProjectStore;
  view: ViewStore;
}) {
  const typeId = useId();
  const edit = (e: FurnitureEdit, label?: string) => store.execute(editFurniture(f.id, e, label));
  const types = [...project.catalog.furnitureTypes].sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );
  const known = types.some((t) => t.id === f.typeId);
  return (
    <div className="device-properties">
      <div className="field">
        <label htmlFor={typeId}>Typ</label>
        <select
          id={typeId}
          value={f.typeId}
          onChange={(e) => {
            const t = types.find((x) => x.id === e.target.value);
            // neuer Typ übernimmt seine Maße
            if (t)
              edit({
                typeId: t.id,
                widthMm: t.widthMm,
                depthMm: t.depthMm,
                heightMm: t.heightMm,
                elevationMm: t.elevationMm,
              });
          }}
        >
          {!known && <option value={f.typeId}>unbekannt ({f.typeId})</option>}
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <MmField label="x (Mitte)" value={f.x} onCommit={(x) => edit({ x }, "Möbel verschieben")} />
      <MmField label="y (Mitte)" value={f.y} onCommit={(y) => edit({ y }, "Möbel verschieben")} />
      <DegField
        label="Drehung"
        value={f.rotationDeg}
        onCommit={(v) => edit({ rotationDeg: roundDeg(((v % 360) + 360) % 360) })}
      />
      <MmField label="Breite" min={1} value={f.widthMm} onCommit={(widthMm) => edit({ widthMm })} />
      <MmField label="Tiefe" min={1} value={f.depthMm} onCommit={(depthMm) => edit({ depthMm })} />
      <MmField
        label="Höhe"
        min={1}
        value={f.heightMm}
        onCommit={(heightMm) => edit({ heightMm })}
      />
      <MmField
        label="Höhe über OKFF"
        min={0}
        value={f.elevationMm}
        onCommit={(elevationMm) => edit({ elevationMm })}
      />
      <button type="button" onClick={() => store.execute(rotateFurniture90(f.id, f.rotationDeg))}>
        Um 90° drehen (R)
      </button>
      <button
        type="button"
        onClick={() => {
          store.execute(deleteFurniture([f.id]));
          view.select(null);
        }}
      >
        Möbel löschen
      </button>
    </div>
  );
}
