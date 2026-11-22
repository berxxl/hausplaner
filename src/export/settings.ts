/**
 * Exporteinstellungen (design.md M5 „Datenmodell und Einstellungen“): Ansichtszustand im Browser,
 * nicht in den Projektdateien. Frei von React.
 */
import { z } from "zod";
import { TRADES } from "../model/schema";

export const SCALES = [20, 25, 50, 100] as const;
export const PAPER_SIZES = ["A4", "A3"] as const;
export const ORIENTATIONS = ["portrait", "landscape"] as const;
export const STATUSES = ["planned", "installed", "verified"] as const;

export const ExportSettingsSchema = z.object({
  scale: z.union([z.literal(20), z.literal(25), z.literal(50), z.literal(100)]),
  paper: z.enum(PAPER_SIZES),
  orientation: z.enum(ORIENTATIONS),
  planStatus: z.string(),
  trades: z.array(z.enum(TRADES)),
  statuses: z.array(z.enum(STATUSES)),
});

export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  scale: 50,
  paper: "A3",
  orientation: "landscape",
  planStatus: "Entwurf",
  trades: [...TRADES],
  statuses: [...STATUSES],
};

export const EXPORT_SETTINGS_KEY = "hausplaner.export";

/** Gespeicherte Einstellungen lesen; Ungültiges fällt auf die Standardwerte zurück. */
export function parseExportSettings(raw: string | null): ExportSettings {
  if (!raw) return { ...DEFAULT_EXPORT_SETTINGS };
  try {
    const r = ExportSettingsSchema.partial().safeParse(JSON.parse(raw));
    return r.success ? { ...DEFAULT_EXPORT_SETTINGS, ...r.data } : { ...DEFAULT_EXPORT_SETTINGS };
  } catch {
    return { ...DEFAULT_EXPORT_SETTINGS };
  }
}

/** Bestandsplan: genau „verlegt“ und „geprüft“ gewählt (design.md M5 „Planinhalte“). */
export function isAsBuilt(statuses: readonly string[]): boolean {
  return statuses.length === 2 && statuses.includes("installed") && statuses.includes("verified");
}
