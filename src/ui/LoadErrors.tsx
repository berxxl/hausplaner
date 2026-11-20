import type { LoadError } from "../io/load";

/** Fehlerseite: das Projekt wird nicht geöffnet; nach Änderungen an den Dateien lädt die App automatisch neu. */
export function LoadErrors({ errors, onRetry }: { errors: LoadError[]; onRetry(): void }) {
  return (
    <main aria-label="Hausplaner" className="start-page">
      <h1>Projekt kann nicht geöffnet werden</h1>
      <ul aria-label="Ladefehler">
        {errors.map((e, i) => (
          <li key={i}>
            {e.file && <strong>{e.file}</strong>}
            {e.line ? `, Zeile ${e.line}` : ""}
            {e.file ? ": " : ""}
            {e.message}
          </li>
        ))}
      </ul>
      <p>
        Es wurde nichts geschrieben. Nach dem Korrigieren der Dateien lädt die App automatisch neu.
      </p>
      <button type="button" onClick={onRetry}>
        Erneut laden
      </button>
    </main>
  );
}
