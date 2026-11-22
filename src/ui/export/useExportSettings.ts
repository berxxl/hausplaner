/** Exporteinstellungen im localStorage (design.md M5 „Datenmodell und Einstellungen“). */
import { useCallback, useState } from "react";
import {
  EXPORT_SETTINGS_KEY,
  parseExportSettings,
  type ExportSettings,
} from "../../export/settings";

function read(): ExportSettings {
  try {
    return parseExportSettings(window.localStorage.getItem(EXPORT_SETTINGS_KEY));
  } catch {
    return parseExportSettings(null);
  }
}

/** `initial` überschreibt beim Öffnen gespeicherte Werte (z. B. Gewerke aus dem App-Filter). */
export function useExportSettings(initial: Partial<ExportSettings> = {}) {
  const [settings, setSettings] = useState<ExportSettings>(() => ({ ...read(), ...initial }));
  const update = useCallback((patch: Partial<ExportSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        window.localStorage.setItem(EXPORT_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Speichern ist Komfort; ohne localStorage gelten die Werte nur bis zum Schließen
      }
      return next;
    });
  }, []);
  return [settings, update] as const;
}
