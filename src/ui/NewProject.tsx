import { useState } from "react";
import { newProject } from "../model/factory";
import type { Project } from "../model/types";

export interface NewProjectProps {
  folder: string;
  missing: boolean;
  onCreate(project: Project): Promise<void>;
}

/** Leerer oder fehlender Projektordner: Angebot, ein neues Projekt anzulegen. */
export function NewProject({ folder, missing, onCreate }: NewProjectProps) {
  const [name, setName] = useState(folder);
  const [storeyName, setStoreyName] = useState("EG");
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (declined) {
    return (
      <main aria-label="Hausplaner" className="start-page">
        <p role="note">Kein Projekt angelegt. Im Ordner „{folder}“ wurde nichts geschrieben.</p>
        <button type="button" onClick={() => setDeclined(false)}>
          Projekt doch anlegen
        </button>
      </main>
    );
  }

  return (
    <main aria-label="Hausplaner" className="start-page">
      <form
        aria-label="Neues Projekt"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          onCreate(newProject(name.trim() || folder, storeyName.trim() || "EG"))
            .catch((err: unknown) => setError((err as Error).message))
            .finally(() => setBusy(false));
        }}
      >
        <h1>Neues Projekt</h1>
        <p>
          {missing
            ? `Der Ordner „${folder}“ existiert nicht. Er wird beim Anlegen erstellt.`
            : `Im Ordner „${folder}“ liegt noch kein Projekt.`}
        </p>
        <label>
          Projektname
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Erstes Geschoss
          <input value={storeyName} onChange={(e) => setStoreyName(e.target.value)} />
        </label>
        <p className="hint">
          Höhenlage 0 mm, Rohbauhöhe 2500 mm, Fußbodenaufbau 120 mm, Putz 15 mm, Abhängung 0 mm;
          später änderbar.
        </p>
        {error && <p role="alert">Anlegen fehlgeschlagen: {error}</p>}
        <button type="button" onClick={() => setDeclined(true)} disabled={busy}>
          Nicht anlegen
        </button>
        <button type="submit" disabled={busy}>
          Anlegen
        </button>
      </form>
    </main>
  );
}
