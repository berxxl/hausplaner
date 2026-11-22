/**
 * Dialog „PDF exportieren“ (design.md M5 „Exportdialog“): Inhalt, Maßstab, Format, Planstand,
 * Gewerke, Status, Passmeldungen, Fortschritt, Download.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { pdfFileName, type ExportOptions } from "../../export/compose";
import {
  buildSheets,
  boardOrder,
  EMPTY_SELECTION,
  setStorey,
  sortedRooms,
  sortedStoreys,
  type ExportSelection,
} from "../../export/selection";
import { fitMessage, formatDate, formatLabel } from "../../export/sheet";
import { isAsBuilt, SCALES, type ExportSettings } from "../../export/settings";
import { TRADES } from "../../model/schema";
import type { Status, Trade } from "../../model/types";
import { LISTS, type ListKind } from "../../reports/lists";
import type { ProjectStore } from "../../store/history";
import type { ViewStore } from "../../store/view";
import { STATUS_LABELS, TRADE_LABELS } from "../labels";
import { useExportSettings } from "./useExportSettings";

const FORMATS = [
  { paper: "A3", orientation: "landscape" },
  { paper: "A3", orientation: "portrait" },
  { paper: "A4", orientation: "landscape" },
  { paper: "A4", orientation: "portrait" },
] as const;
const STATUSES: Status[] = ["planned", "installed", "verified"];

type RoomKey = "walls" | "ceilings" | "floors" | "slopes";
const ROOM_PARTS: { key: RoomKey; label: string }[] = [
  { key: "walls", label: "Wandansichten" },
  { key: "ceilings", label: "Decke" },
  { key: "floors", label: "Boden" },
  { key: "slopes", label: "Schrägen" },
];

export function ExportDialog({
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
  const activeStoreyId = useStore(view, (s) => s.activeStoreyId);
  const [settings, update] = useExportSettings({
    trades: TRADES.filter((t) => !hiddenTrades.includes(t)),
  });
  const [sel, setSel] = useState<ExportSelection>(() => ({
    ...EMPTY_SELECTION,
    plans: activeStoreyId ? [activeStoreyId] : project.storeys[0] ? [project.storeys[0].id] : [],
  }));
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // Fokus in den Dialog, damit Esc sofort schließt
  useEffect(() => ref.current?.focus(), []);

  const options: ExportOptions = useMemo(
    () => ({
      format: { paper: settings.paper, orientation: settings.orientation },
      scale: settings.scale,
      project: project.name,
      date: formatDate(new Date()),
      planStatus: settings.planStatus,
      trades: settings.trades,
      statuses: settings.statuses,
    }),
    [settings, project.name],
  );
  const sheets = useMemo(() => buildSheets(project, sel, options), [project, sel, options]);
  const messages = sheets
    .filter((s) => s.fit && !s.fit.ok)
    .map((s) => fitMessage(s.content, options.scale, options.format, s.fit!.needed));

  const toggleIn = <T,>(xs: readonly T[], x: T, on: boolean) =>
    on ? [...new Set([...xs, x])] : xs.filter((y) => y !== x);
  const setPart = (key: keyof ExportSelection, id: string, on: boolean) =>
    setSel((s) => ({ ...s, [key]: toggleIn(s[key] as string[], id, on) }));
  const storeyAll = (storeyId: string) =>
    sel.plans.includes(storeyId) &&
    sel.freeSurfaces.includes(storeyId) &&
    sortedRooms(project, storeyId).every(
      (r) => sel.walls.includes(r.id) && sel.ceilings.includes(r.id) && sel.floors.includes(r.id),
    );

  const run = async () => {
    setError(null);
    setProgress(`Seite 0 von ${sheets.length} …`);
    try {
      // svg2pdf.js und jsPDF erst beim Exportieren laden
      const { sheetsToPdf, downloadBlob } = await import("../../export/pdf");
      const blob = await sheetsToPdf(
        sheets.map((s) => s.sheet),
        { title: project.name, onProgress: (i, n) => setProgress(`Seite ${i} von ${n} …`) },
      );
      downloadBlob(
        blob,
        pdfFileName(
          project.name,
          options.date,
          sheets.length === 1 ? sheets[0]!.content : undefined,
        ),
      );
      setProgress(`${sheets.length} ${sheets.length === 1 ? "Seite" : "Seiten"} exportiert`);
    } catch (e) {
      setProgress(null);
      setError(`Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const busy = progress !== null && progress.endsWith("…");
  return (
    <div className="dialog-backdrop">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="dialog export-dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
        }}
      >
        <h2 id="export-title">PDF exportieren</h2>
        <div className="export-dialog__columns">
          <fieldset className="export-dialog__content" aria-label="Inhalt">
            <legend>Inhalt</legend>
            {sortedStoreys(project).map((storey) => (
              <div key={storey.id} className="export-dialog__storey">
                <label className="export-dialog__strong">
                  <input
                    type="checkbox"
                    checked={storeyAll(storey.id)}
                    onChange={(e) =>
                      setSel((s) => setStorey(project, s, storey.id, e.target.checked))
                    }
                  />{" "}
                  {storey.name}
                </label>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Grundriss ${storey.name}`}
                    checked={sel.plans.includes(storey.id)}
                    onChange={(e) => setPart("plans", storey.id, e.target.checked)}
                  />{" "}
                  Grundriss
                </label>
                {sortedRooms(project, storey.id).map((room) => (
                  <div key={room.id} className="export-dialog__room">
                    <span>{room.name}:</span>
                    {ROOM_PARTS.filter(
                      (p) => p.key !== "slopes" || (room.slopes ?? []).length > 0,
                    ).map((p) => (
                      <label key={p.key}>
                        <input
                          type="checkbox"
                          aria-label={`${room.name} ${p.label}`}
                          checked={sel[p.key].includes(room.id)}
                          onChange={(e) => setPart(p.key, room.id, e.target.checked)}
                        />{" "}
                        {p.label}
                      </label>
                    ))}
                  </div>
                ))}
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Flächen ohne Raum ${storey.name}`}
                    checked={sel.freeSurfaces.includes(storey.id)}
                    onChange={(e) => setPart("freeSurfaces", storey.id, e.target.checked)}
                  />{" "}
                  Flächen ohne Raum
                </label>
              </div>
            ))}
            {project.boards.length > 0 && (
              <div className="export-dialog__storey">
                <span className="export-dialog__strong">Verteiler</span>
                {boardOrder(project).map((id) => {
                  const b = project.boards.find((x) => x.id === id)!;
                  return (
                    <label key={id}>
                      <input
                        type="checkbox"
                        aria-label={`Belegung ${b.label}`}
                        checked={sel.boards.includes(id)}
                        onChange={(e) => setPart("boards", id, e.target.checked)}
                      />{" "}
                      Belegung {b.label}
                    </label>
                  );
                })}
              </div>
            )}
            <div className="export-dialog__storey">
              <span className="export-dialog__strong">Listen</span>
              {LISTS.map((l) => (
                <label key={l.kind}>
                  <input
                    type="checkbox"
                    aria-label={`Liste ${l.label}`}
                    checked={sel.lists.includes(l.kind)}
                    onChange={(e) =>
                      setSel((s) => ({
                        ...s,
                        lists: toggleIn(s.lists, l.kind as ListKind, e.target.checked),
                      }))
                    }
                  />{" "}
                  {l.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="export-dialog__settings">
            <ExportSettingsFields settings={settings} update={update} />
          </div>
        </div>
        {messages.length > 0 && (
          <ul aria-label="Meldungen" className="export-dialog__messages">
            {messages.map((m) => (
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
          {progress ?? `${sheets.length} ${sheets.length === 1 ? "Blatt" : "Blätter"}`}
        </p>
        <div className="dialog__buttons">
          <button type="button" onClick={onClose} disabled={busy}>
            Schließen
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || sheets.length === 0 || messages.length > 0}
          >
            Exportieren
          </button>
        </div>
      </div>
    </div>
  );
}

/** Maßstab, Format, Planstand, Gewerke, Status (auch für die Baustellen-PDF ohne Maßstab/Format). */
export function ExportSettingsFields({
  settings,
  update,
  site = false,
}: {
  settings: ExportSettings;
  update(patch: Partial<ExportSettings>): void;
  site?: boolean;
}) {
  const toggle = <T,>(xs: readonly T[], x: T) =>
    xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
  return (
    <>
      {!site && (
        <>
          <label>
            Maßstab{" "}
            <select
              aria-label="Maßstab"
              value={settings.scale}
              onChange={(e) => update({ scale: Number(e.target.value) as ExportSettings["scale"] })}
            >
              {SCALES.map((s) => (
                <option key={s} value={s}>
                  1:{s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format{" "}
            <select
              aria-label="Format"
              value={`${settings.paper} ${settings.orientation}`}
              onChange={(e) => {
                const [paper, orientation] = e.target.value.split(" ") as [
                  ExportSettings["paper"],
                  ExportSettings["orientation"],
                ];
                update({ paper, orientation });
              }}
            >
              {FORMATS.map((f) => (
                <option key={`${f.paper} ${f.orientation}`} value={`${f.paper} ${f.orientation}`}>
                  {formatLabel(f)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        Planstand{" "}
        <input
          aria-label="Planstand"
          value={settings.planStatus}
          onChange={(e) => update({ planStatus: e.target.value })}
        />
      </label>
      <div role="group" aria-label="Gewerke" className="lists__toggles">
        {TRADES.map((t: Trade) => (
          <button
            key={t}
            type="button"
            aria-pressed={settings.trades.includes(t)}
            onClick={() => update({ trades: toggle(settings.trades, t) })}
          >
            {TRADE_LABELS[t]}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Status" className="lists__toggles">
        {STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            aria-pressed={settings.statuses.includes(st)}
            onClick={() => update({ statuses: toggle(settings.statuses, st) })}
          >
            {STATUS_LABELS[st]}
          </button>
        ))}
      </div>
      {isAsBuilt(settings.statuses) && (
        <p className="field-info" aria-label="Planart">
          Bestandsplan (nur verlegte und geprüfte Elemente)
        </p>
      )}
    </>
  );
}
