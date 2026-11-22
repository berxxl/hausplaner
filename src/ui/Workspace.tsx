import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import type { ProjectStore } from "../store/history";
import type { SaveController } from "../store/save";
import type { Api } from "../io/api";
import { createViewStore, type Selection } from "../store/view";
import type { Project } from "../model/types";
import { sortedStoreys } from "../io/project-files";
import { EditorArea } from "./EditorArea";
import { Properties } from "./Properties";
import { ProjectSettings } from "./ProjectSettings";
import { ExportDialog } from "./export/ExportDialog";
import { SiteExportDialog } from "./export/SiteExportDialog";
import { CatalogDialog } from "./catalog/CatalogDialog";
import { Tree } from "./Tree";
import { WarningBar } from "./WarningBar";
import { useConfirm } from "./useConfirm";
import { ExternalChanges } from "./ExternalChanges";
import { SaveStatus } from "./SaveStatus";
import { useGlobalShortcuts } from "./shortcuts";

export interface WorkspaceProps {
  store: ProjectStore;
  save: SaveController;
  /** Lädt das Projekt neu (neuer Store, leere Undo-Historie). */
  onReload?(): void;
  /** Hinweis beim Öffnen, z. B. nach einer Migration. */
  notice?: string;
  /** Für das Hochladen von Plänen. */
  api?: Pick<Api, "putPlan">;
}

export function Workspace({ store, save, onReload, notice, api }: WorkspaceProps) {
  const [showNotice, setShowNotice] = useState(!!notice);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const name = useStore(store, (s) => s.project.name);
  const { confirm, dialog } = useConfirm();
  const [view] = useState(() =>
    createViewStore({ activeStoreyId: sortedStoreys(store.getState().project)[0]?.id ?? null }),
  );
  // Auswahl verwerfen, wenn ihr Objekt verschwindet (Löschen, Undo)
  useEffect(
    () =>
      store.subscribe((s) => {
        view.prune((sel) => selectionExists(s.project, sel));
        // aktives Geschoss gelöscht: auf das unterste verbleibende wechseln
        const active = view.getState().activeStoreyId;
        if (!s.project.storeys.some((x) => x.id === active)) {
          view.setActiveStorey(sortedStoreys(s.project)[0]?.id ?? null);
        }
      }),
    [store, view],
  );

  const onSave = useCallback(async () => {
    if (save.getState().externalChanges.length > 0) {
      const ok = await confirm({
        title: "Externe Änderungen überschreiben?",
        message:
          "Die Dateien wurden außerhalb der App geändert. Beim Speichern werden diese Änderungen überschrieben.",
        confirmLabel: "Überschreiben",
      });
      if (!ok) return;
      await save.saveNow({ overwrite: true });
    } else {
      await save.saveNow();
    }
  }, [save, confirm]);

  const reload = useCallback(async () => {
    if (save.hasUnsavedChanges()) {
      const ok = await confirm({
        title: "Ungespeicherte Änderungen verwerfen?",
        message: "Beim Neuladen gehen die Änderungen seit dem letzten Speichern verloren.",
        confirmLabel: "Verwerfen und neu laden",
      });
      if (!ok) return;
    }
    onReload?.();
  }, [save, confirm, onReload]);

  const onSaveShortcut = useCallback(() => void onSave(), [onSave]);
  useGlobalShortcuts({ store, onSave: onSaveShortcut });

  return (
    <div className="workspace">
      <header className="workspace__header">
        <h1>{name}</h1>
        <SaveStatus save={save} />
        <button type="button" className="workspace__settings" onClick={() => setCatalogOpen(true)}>
          Katalog
        </button>
        <button type="button" onClick={() => setExportOpen(true)}>
          Exportieren …
        </button>
        <button type="button" onClick={() => setSiteOpen(true)}>
          Baustellen-PDF …
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          Projekteinstellungen
        </button>
      </header>
      <div className="workspace__notices">
        <ExternalChanges save={save} onReload={() => void reload()} />
        {showNotice && notice && (
          <div role="region" aria-label="Hinweis" className="notice">
            {notice}{" "}
            <button type="button" onClick={() => setShowNotice(false)}>
              OK
            </button>
          </div>
        )}
      </div>
      <Tree store={store} view={view} />
      <EditorArea store={store} view={view} />
      <Properties store={store} view={view} api={api} />
      <WarningBar store={store} view={view} />
      {settingsOpen && <ProjectSettings store={store} onClose={() => setSettingsOpen(false)} />}
      {catalogOpen && <CatalogDialog store={store} onClose={() => setCatalogOpen(false)} />}
      {exportOpen && (
        <ExportDialog store={store} view={view} onClose={() => setExportOpen(false)} />
      )}
      {siteOpen && (
        <SiteExportDialog store={store} view={view} onClose={() => setSiteOpen(false)} />
      )}
      {dialog}
    </div>
  );
}

function selectionExists(project: Project, sel: Selection): boolean {
  switch (sel.kind) {
    case "storey":
      return project.storeys.some((x) => x.id === sel.id);
    case "wall":
      return project.walls.some((x) => x.id === sel.id);
    case "room":
      return project.rooms.some((x) => x.id === sel.id);
    case "opening":
      return project.openings.some((x) => x.id === sel.id);
    case "slope":
      return project.rooms.some((r) => r.slopes?.some((x) => x.id === sel.id));
    case "device":
      return (sel.ids ?? [sel.id]).every((id) => project.devices.some((x) => x.id === id));
    case "furniture":
      return project.furniture.some((x) => x.id === sel.id);
    case "route-node":
      return project.routeNodes.some((x) => x.id === sel.id);
    case "route-segment":
      return (sel.ids ?? [sel.id]).every((id) => project.routeSegments.some((x) => x.id === id));
    case "cable":
      return project.cables.some((x) => x.id === sel.id);
    case "board":
      return project.boards.some((x) => x.id === sel.id);
    case "circuit":
      return project.circuits.some((x) => x.id === sel.id);
    case "room-boundary":
      return project.roomBoundaries.some((x) => x.id === sel.id);
  }
}
