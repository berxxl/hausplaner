/**
 * Werkzeug „Leitung“ für Grundriss und Flächenansicht (design.md M3 „Leitungen“): erstes Gerät,
 * zweites Gerät (auch in anderer Ansicht), dann Dialog mit passenden Leitungstypen.
 */
import { useState } from "react";
import { useStore } from "zustand";
import { compatibleLineTypes } from "../geometry/cables";
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import { addCable, noMatchingLineMessage } from "../store/cables";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { CableDialog } from "./plan/dialogs";

export function useCableTool(
  store: ProjectStore,
  view: ViewStore,
  setMessage: (m: string) => void,
) {
  const cableFrom = useStore(view, (s) => s.cableFrom);
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const project = useStore(store, (s) => s.project);

  /** Klick auf ein Gerät mit dem Werkzeug „Leitung“. */
  const clickDevice = (deviceId: string | undefined) => {
    if (!deviceId) return setMessage("Ein Gerät anklicken.");
    if (!cableFrom) return view.setCableFrom(deviceId);
    if (deviceId === cableFrom) return;
    if (compatibleLineTypes(project, cableFrom, deviceId).length === 0) {
      setMessage(noMatchingLineMessage(project, cableFrom, deviceId));
      return;
    }
    setPending({ from: cableFrom, to: deviceId });
  };

  const label = (id: string) => project.devices.find((d) => d.id === id)?.label ?? id;
  const dialog = pending ? (
    <CableDialog
      types={compatibleLineTypes(project, pending.from, pending.to)}
      defaultLabel={`${label(pending.from)} – ${label(pending.to)}`}
      onCancel={() => setPending(null)}
      onSubmit={({ lineTypeId, label: l }) => {
        const id = newId(new Set(allIds(project)));
        const r = addCable(project, {
          id,
          label: l,
          lineTypeId,
          from: { deviceId: pending.from },
          to: { deviceId: pending.to },
        });
        setPending(null);
        view.setCableFrom(null);
        if (!r.ok) return setMessage(r.error);
        store.execute(r.command);
        view.select({ kind: "cable", id });
      }}
    />
  ) : null;
  return { cableFrom, clickDevice, dialog };
}
