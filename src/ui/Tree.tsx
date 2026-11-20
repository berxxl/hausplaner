import { useStore } from "zustand";
import { sortedStoreys } from "../io/project-files";
import type { ProjectStore } from "../store/history";
import type { ViewStore } from "../store/view";

/** Strukturbaum; in diesem Ausbauschritt nur die Geschossebene. */
export function Tree({ store, view }: { store: ProjectStore; view: ViewStore }) {
  const project = useStore(store, (s) => s.project);
  const selection = useStore(view, (s) => s.selection);
  const storeys = sortedStoreys(project);
  return (
    <nav aria-label="Strukturbaum" className="tree">
      <ul role="tree" aria-label="Geschosse">
        {storeys.map((storey) => {
          const selected = selection?.kind === "storey" && selection.id === storey.id;
          return (
            <li
              key={storey.id}
              role="treeitem"
              aria-selected={selected}
              tabIndex={0}
              className={selected ? "tree__item tree__item--selected" : "tree__item"}
              onClick={() => {
                view.select({ kind: "storey", id: storey.id });
                view.setActiveStorey(storey.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  view.select({ kind: "storey", id: storey.id });
                  view.setActiveStorey(storey.id);
                }
              }}
            >
              {storey.name}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
