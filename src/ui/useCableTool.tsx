/**
 * Werkzeug „Leitung“ für Grundriss und Flächenansicht (design.md M3 „Leitungen“): erstes Gerät,
 * zweites Gerät (auch in anderer Ansicht), dann Dialog mit passenden Leitungstypen.
 */
import { useState } from "react";
import { useStore } from "zustand";
import { compatibleLineTypes, endpointLabel, sameEndpoint } from "../geometry/cables";
import type { Endpoint } from "../model/types";
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
  const [pending, setPending] = useState<{ from: Endpoint; to: Endpoint } | null>(null);
  const project = useStore(store, (s) => s.project);

  /** Klick auf ein Gerät oder einen Verteiler mit dem Werkzeug „Leitung“ (design.md M4). */
  const clickEndpoint = (ep: Endpoint | undefined) => {
    if (!ep) return setMessage("Ein Gerät oder einen Verteiler anklicken.");
    if (!cableFrom) return view.setCableFrom(ep);
    if (sameEndpoint(ep, cableFrom)) return;
    if (compatibleLineTypes(project, cableFrom, ep).length === 0) {
      setMessage(noMatchingLineMessage(project, cableFrom, ep));
      return;
    }
    setPending({ from: cableFrom, to: ep });
  };

  const dialog = pending ? (
    <CableDialog
      types={compatibleLineTypes(project, pending.from, pending.to)}
      defaultLabel={`${endpointLabel(project, pending.from)} – ${endpointLabel(project, pending.to)}`}
      onCancel={() => setPending(null)}
      onSubmit={({ lineTypeId, label: l }) => {
        const id = newId(new Set(allIds(project)));
        const r = addCable(project, {
          id,
          label: l,
          lineTypeId,
          from: pending.from,
          to: pending.to,
        });
        setPending(null);
        view.setCableFrom(null);
        if (!r.ok) return setMessage(r.error);
        store.execute(r.command);
        view.select({ kind: "cable", id });
      }}
    />
  ) : null;
  return { cableFrom, clickEndpoint, dialog };
}
