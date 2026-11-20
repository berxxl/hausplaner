import { storeyFilePath } from "../io/paths";
import { deleteStorey, editStorey } from "../store/commands";
import type { ProjectStore } from "../store/history";
import type { Storey } from "../model/types";
import { MmField, TextField } from "./fields";
import type { Api } from "../io/api";
import { UnderlayProperties } from "./UnderlayProperties";

/** Eigenschaften eines Geschosses: Name, Höhen, Standardaufbauten, Löschen. */
export function StoreyProperties({
  storey,
  store,
  api,
}: {
  storey: Storey;
  store: ProjectStore;
  api?: Pick<Api, "putPlan">;
}) {
  const edit = (e: Parameters<typeof editStorey>[1]) => store.execute(editStorey(storey.id, e));
  return (
    <div>
      <TextField
        label="Name"
        value={storey.name}
        onCommit={(value) => edit({ field: "name", value })}
      />
      <p className="hint">Datei: {storeyFilePath(storey.slug)}</p>
      <MmField
        label="Höhenlage Rohfußboden"
        value={storey.elevationMm}
        onCommit={(value) => edit({ field: "elevationMm", value })}
      />
      <MmField
        label="Rohbauhöhe"
        min={1}
        value={storey.rawHeightMm}
        onCommit={(value) => edit({ field: "rawHeightMm", value })}
      />
      <h3>Standardwerte für Räume</h3>
      <MmField
        label="Fußbodenaufbau"
        min={0}
        value={storey.defaults.floorBuildupMm}
        onCommit={(value) => edit({ field: "floorBuildupMm", value })}
      />
      <MmField
        label="Putzstärke"
        min={0}
        value={storey.defaults.plasterMm}
        onCommit={(value) => edit({ field: "plasterMm", value })}
      />
      <MmField
        label="Abhängung"
        min={0}
        value={storey.defaults.suspendedMm}
        onCommit={(value) => edit({ field: "suspendedMm", value })}
      />
      <UnderlayProperties storey={storey} store={store} api={api} />
      <button
        type="button"
        className="danger"
        onClick={() => store.execute(deleteStorey(storey.id))}
      >
        Geschoss löschen
      </button>
    </div>
  );
}
