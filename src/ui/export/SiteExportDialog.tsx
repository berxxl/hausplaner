/**
 * Dialog „Baustellen-PDF“ (design.md M5 „Baustellen-PDF“): Räume wählen, Filter, Seitenzahl,
 * Meldungen; erzeugt die PDF mit eingebetteter Seitenzuordnung.
 */
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { pdfFileName } from "../../export/compose";
import { SITE_PDF_NAMESPACE, siteMappingText } from "../../export/mapping";
import { sortedRooms, sortedStoreys } from "../../export/selection";
import { formatDate } from "../../export/sheet";
import { siteSheets } from "../../export/site";
import { TRADES } from "../../model/schema";
import type { ProjectStore } from "../../store/history";
import type { ViewStore } from "../../store/view";
import { ExportSettingsFields } from "./ExportDialog";
import { useExportSettings } from "./useExportSettings";

export function SiteExportDialog({
  store,
  view,
  onClose,
}: {
  store: ProjectStore;
  view: ViewStore;
  onClose(): void;
}) {
  const project = useStore(store, (s) => s.project);
  const hiddenTrades = useStore(view, (s) => s.hiddenTrades);
  const [settings, update] = useExportSettings({
    trades: TRADES.filter((t) => !hiddenTrades.includes(t)),
  });
  const [rooms, setRooms] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const date = formatDate(new Date());

  const result = useMemo(
    () =>
      siteSheets(
        project,
        rooms,
        {
          project: project.name,
          date,
          planStatus: settings.planStatus,
          trades: settings.trades,
          statuses: settings.statuses,
        },
        new Date().toISOString(),
      ),
    [project, rooms, settings, date],
  );

  const toggle = (ids: string[], on: boolean) =>
    setRooms((xs) => (on ? [...new Set([...xs, ...ids])] : xs.filter((x) => !ids.includes(x))));

  const run = async () => {
    setError(null);
    setProgress(`Seite 0 von ${result.pages.length} …`);
    try {
      const { sheetsToPdf, downloadBlob } = await import("../../export/pdf");
      const fresh = { ...result.mapping, exportedAt: new Date().toISOString() };
      const blob = await sheetsToPdf(
        result.pages.map((p) => p.sheet),
        {
          title: `${project.name} Baustelle`,
          metadata: { text: siteMappingText(fresh), namespace: SITE_PDF_NAMESPACE },
          onProgress: (i, n) => setProgress(`Seite ${i} von ${n} …`),
        },
      );
      downloadBlob(blob, pdfFileName(project.name, date, "Baustelle"));
      setProgress(
        `${result.pages.length} ${result.pages.length === 1 ? "Seite" : "Seiten"} erzeugt`,
      );
    } catch (e) {
      setProgress(null);
      setError(`Erzeugen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const busy = progress !== null && progress.endsWith("…");
  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-title"
        className="dialog export-dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
        }}
      >
        <h2 id="site-title">Baustellen-PDF</h2>
        <p className="field-info">
          Je Wandansicht, Decke, Boden und Schräge eine A4-Seite in 1:20 (bei Bedarf 1:25 oder 1:50)
          mit Raster, Bemaßung und Notizbereich.
        </p>
        <div className="export-dialog__columns">
          <fieldset className="export-dialog__content" aria-label="Räume">
            <legend>Räume</legend>
            {sortedStoreys(project).map((storey) => {
              const ids = sortedRooms(project, storey.id).map((r) => r.id);
              return (
                <div key={storey.id} className="export-dialog__storey">
                  <label className="export-dialog__strong">
                    <input
                      type="checkbox"
                      checked={ids.length > 0 && ids.every((id) => rooms.includes(id))}
                      onChange={(e) => toggle(ids, e.target.checked)}
                    />{" "}
                    {storey.name}
                  </label>
                  {sortedRooms(project, storey.id).map((room) => (
                    <label key={room.id} className="export-dialog__room">
                      <input
                        type="checkbox"
                        aria-label={`${storey.name} ${room.name}`}
                        checked={rooms.includes(room.id)}
                        onChange={(e) => toggle([room.id], e.target.checked)}
                      />{" "}
                      {room.name}
                    </label>
                  ))}
                </div>
              );
            })}
          </fieldset>
          <div className="export-dialog__settings">
            <ExportSettingsFields settings={settings} update={update} site />
          </div>
        </div>
        {result.errors.length > 0 && (
          <ul aria-label="Meldungen" className="export-dialog__messages">
            {result.errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="export-dialog__error">
            {error}
          </p>
        )}
        <p role="status" aria-label="Fortschritt" className="field-info">
          {progress ?? `${result.pages.length} ${result.pages.length === 1 ? "Seite" : "Seiten"}`}
        </p>
        <div className="dialog__buttons">
          <button type="button" onClick={onClose} disabled={busy}>
            Schließen
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || result.pages.length === 0 || result.errors.length > 0}
          >
            Erzeugen
          </button>
        </div>
      </div>
    </div>
  );
}
