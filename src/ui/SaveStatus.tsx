import { useStore } from "zustand";
import type { SaveController } from "../store/save";

const LABELS = {
  saved: "gespeichert",
  unsaved: "ungespeichert",
  saving: "speichert …",
  error: "Fehler beim Speichern",
} as const;

export function SaveStatus({ save }: { save: SaveController }) {
  const status = useStore(save, (s) => s.status);
  const errors = useStore(save, (s) => s.errors);
  const detail = Object.entries(errors)
    .map(([path, message]) => (path === "*" ? message : `${path}: ${message}`))
    .join("\n");
  return (
    <span
      role="status"
      aria-label="Speicherstand"
      data-status={status}
      className={`save-status save-status--${status}`}
      title={detail || undefined}
    >
      {LABELS[status]}
    </span>
  );
}
