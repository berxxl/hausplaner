import { useStore } from "zustand";
import { TRADES } from "../model/schema";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";
import { visibleSelection } from "./filter";
import { TRADE_LABELS } from "./labels";

/** Schalter je Gewerk, für Möbel und für Trassen in der Kopfzeile des Editorbereichs. */
export function TradeFilter({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const hiddenTrades = useStore(view, (s) => s.hiddenTrades);
  const furnitureHidden = useStore(view, (s) => s.furnitureHidden);
  const routesHidden = useStore(view, (s) => s.routesHidden);
  // Auswahl eines ausgeblendeten Elements aufheben
  const prune = () => {
    const s = view.getState();
    const next = visibleSelection(store.getState().project, s, s.selection);
    if (JSON.stringify(next) !== JSON.stringify(s.selection)) view.select(next);
  };
  return (
    <div role="group" aria-label="Gewerkfilter" className="editor__filter">
      {TRADES.map((trade) => {
        const visible = !hiddenTrades.includes(trade);
        return (
          <button
            key={trade}
            type="button"
            aria-pressed={visible}
            onClick={() => {
              view.setTradeHidden(trade, visible);
              prune();
            }}
          >
            {TRADE_LABELS[trade]}
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={!furnitureHidden}
        onClick={() => {
          view.setFurnitureHidden(!furnitureHidden);
          prune();
        }}
      >
        Möbel
      </button>
      <button
        type="button"
        aria-pressed={!routesHidden}
        onClick={() => {
          view.setRoutesHidden(!routesHidden);
          prune();
        }}
      >
        Trassen
      </button>
    </div>
  );
}
