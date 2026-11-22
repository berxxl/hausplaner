/** Tabelle „KNX“ eines Verteilers (design.md M4 „KNX“): Bedarf, Vorschlag, Übernehmen, Zuordnen. */
import { useState } from "react";
import { boardKnx, KNX_FUNCTION_LABELS } from "../geometry/knx";
import { allIds } from "../model/factory";
import { newId } from "../model/ids";
import type { Board, Project } from "../model/types";
import type { Checked } from "../store/catalog";
import type { ProjectStore } from "../store/history";
import { adoptSuggestion, autoAssignChannels } from "../store/knx";

/** „1 × Schaltaktor 16-fach“ aus den Typen eines Vorschlags. */
function suggestionText(types: { id: string; name: string }[]): string {
  if (types.length === 0) return "–";
  const counts = new Map<string, { name: string; n: number }>();
  for (const t of types) counts.set(t.id, { name: t.name, n: (counts.get(t.id)?.n ?? 0) + 1 });
  return [...counts.values()].map((c) => `${c.n} × ${c.name}`).join(", ");
}

export function BoardKnx({
  board,
  project,
  store,
}: {
  board: Board;
  project: Project;
  store: ProjectStore;
}) {
  const [error, setError] = useState<string | null>(null);
  const rows = boardKnx(project, board.id);
  const run = (r: Checked) => {
    if (!r.ok) return setError(r.error);
    setError(null);
    store.execute(r.command);
  };
  if (rows.length === 0) return null;
  const needed = rows.some((r) => (r.suggestion?.types.length ?? 0) > 0);
  return (
    <>
      <h3>KNX</h3>
      <table className="board-knx" aria-label="KNX">
        <thead>
          <tr>
            <th>Funktion</th>
            <th>Bedarf</th>
            <th>mit Reserve</th>
            <th>vorhanden</th>
            <th>Vorschlag</th>
            <th>TE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fn} aria-label={KNX_FUNCTION_LABELS[r.fn]}>
              <td>{KNX_FUNCTION_LABELS[r.fn]}</td>
              <td>{r.demand}</td>
              <td>{r.required}</td>
              <td>{r.provided}</td>
              <td>{r.suggestion ? suggestionText(r.suggestion.types) : "Kein Aktor im Katalog"}</td>
              <td>{r.suggestion?.te ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        disabled={!needed}
        onClick={() => {
          const taken = new Set(allIds(project));
          const n = rows.reduce((s, r) => s + (r.suggestion?.types.length ?? 0), 0);
          const ids = Array.from({ length: n }, () => {
            const id = newId(taken);
            taken.add(id);
            return id;
          });
          run(adoptSuggestion(project, board.id, ids));
        }}
      >
        Vorschlag übernehmen
      </button>
      <button type="button" onClick={() => run(autoAssignChannels(project, board.id))}>
        Kanäle automatisch zuordnen
      </button>
      {error && (
        <p role="alert" className="settings__error">
          {error}
        </p>
      )}
    </>
  );
}
