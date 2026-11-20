import { useState } from "react";
import { formatDeg, formatMm, parseDeg, parseMm } from "../model/units";

export interface NumberPromptProps {
  title: string;
  label: string;
  unit: "mm" | "deg";
  initial?: number;
  onSubmit(value: number): void;
  onCancel(): void;
}

/** Abfrage eines Zahlenwerts (mm oder Grad), z. B. Abstand beim Kalibrieren oder Drehwinkel. */
export function NumberPrompt({
  title,
  label,
  unit,
  initial,
  onSubmit,
  onCancel,
}: NumberPromptProps) {
  const format = unit === "mm" ? formatMm : (v: number) => formatDeg(v).replace("°", "");
  const parse = unit === "mm" ? parseMm : parseDeg;
  const [text, setText] = useState(initial === undefined ? "" : format(initial));
  const value = parse(text);
  const valid = value !== null && (unit === "deg" || value > 0);
  return (
    <div className="dialog-backdrop">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="number-prompt-title"
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h2 id="number-prompt-title">{title}</h2>
        <div className="field">
          <label htmlFor="number-prompt-input">{label}</label>
          <input
            id="number-prompt-input"
            autoFocus
            inputMode="decimal"
            value={text}
            aria-invalid={text !== "" && !valid ? true : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          <span className="field__suffix">{unit === "mm" ? "mm" : "°"}</span>
        </div>
        <div className="dialog__buttons">
          <button type="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" disabled={!valid}>
            OK
          </button>
        </div>
      </form>
    </div>
  );
}
