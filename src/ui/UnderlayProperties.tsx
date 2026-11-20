import { useEffect, useRef, useState } from "react";
import { newUnderlay } from "../geometry/underlay";
import type { Api } from "../io/api";
import { roundFraction } from "../model/rounding";
import type { Storey, Underlay } from "../model/types";
import { setUnderlay } from "../store/commands";
import type { ProjectStore } from "../store/history";
import { loadPdf } from "./plan/pdf";

/** Planhintergrund eines Geschosses: PDF wählen, Seite, Kalibrierungsstand, Deckkraft, Sichtbarkeit. */
export function UnderlayProperties({
  storey,
  store,
  api,
}: {
  storey: Storey;
  store: ProjectStore;
  api?: Pick<Api, "putPlan">;
}) {
  const underlay = storey.underlay;
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const numPages = usePageCount(underlay?.file);
  const set = (next: Underlay | undefined, label: string) =>
    store.execute(setUnderlay(storey.id, next, label));

  const choose = async (file: File) => {
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      const { path } = await api.putPlan(file.name, file);
      set(newUnderlay(path), "Plan wählen");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Planhintergrund">
      <h3>Planhintergrund</h3>
      {underlay ? (
        <p className="hint">Datei: {underlay.file}</p>
      ) : (
        <p className="hint">Kein Plan gewählt.</p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="PDF-Datei"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void choose(file);
        }}
      />
      <button type="button" disabled={!api || busy} onClick={() => fileInput.current?.click()}>
        {underlay ? "Andere PDF wählen …" : "PDF wählen …"}
      </button>
      {error && <p role="alert">Hochladen fehlgeschlagen: {error}</p>}
      {underlay && (
        <>
          <div className="field">
            <label htmlFor={`page-${storey.id}`}>Seite</label>
            <select
              id={`page-${storey.id}`}
              value={underlay.page}
              onChange={(e) => set({ ...underlay, page: Number(e.target.value) }, "Seite wählen")}
            >
              {Array.from({ length: Math.max(numPages ?? 1, underlay.page) }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ),
              )}
            </select>
          </div>
          <p className="hint">
            {underlay.calibration
              ? `Kalibriert über ${underlay.calibration.distanceMm} mm`
              : "Nicht kalibriert (Anzeige 1:100). Im Grundriss „Kalibrieren“ wählen."}
          </p>
          <div className="field">
            <label htmlFor={`opacity-${storey.id}`}>Deckkraft</label>
            <input
              id={`opacity-${storey.id}`}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={underlay.opacity}
              onPointerDown={() => store.begin("Deckkraft ändern")}
              onPointerUp={() => store.commit()}
              onChange={(e) => {
                const opacity = roundFraction(Number(e.target.value));
                if (store.getState().transaction) {
                  store.preview((d) => {
                    const s = d.storeys.find((x) => x.id === storey.id);
                    if (s?.underlay) s.underlay.opacity = opacity;
                  });
                } else {
                  set({ ...underlay, opacity }, "Deckkraft ändern");
                }
              }}
            />
            <span className="field__suffix">{Math.round(underlay.opacity * 100)} %</span>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={underlay.visible}
              onChange={(e) =>
                set(
                  { ...underlay, visible: e.target.checked },
                  e.target.checked ? "Plan einblenden" : "Plan ausblenden",
                )
              }
            />
            Plan anzeigen
          </label>
          <button type="button" onClick={() => set(undefined, "Plan entfernen")}>
            Plan entfernen
          </button>
        </>
      )}
    </section>
  );
}

function usePageCount(file: string | undefined): number | null {
  const [count, setCount] = useState<{ file: string; n: number } | null>(null);
  useEffect(() => {
    if (!file || typeof window === "undefined" || !("Worker" in window)) return;
    let cancelled = false;
    loadPdf(file)
      .then((doc) => !cancelled && setCount({ file, n: doc.numPages }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [file]);
  return count && count.file === file ? count.n : null;
}
