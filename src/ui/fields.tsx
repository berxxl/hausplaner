import { useId, useState } from "react";
import { formatDeg, formatMm, parseDeg, parseMm } from "../model/units";

interface FieldProps<T> {
  label: string;
  /** Kleinster gültiger Wert (nur Zahlenfelder). */
  min?: number;
  /** Nach der Übernahme wieder den Ausgangswert zeigen (Aktionsfelder wie „parallel verschieben um“). */
  resetAfterCommit?: boolean;
  value: T;
  /** Wird bei Enter oder Verlassen des Felds mit einem gültigen, geänderten Wert aufgerufen. */
  onCommit(value: T): void;
  suffix?: string;
}

/**
 * Eingabefeld, das den Wert erst bei Enter oder Verlassen übernimmt. Escape und ungültige Eingaben
 * stellen den bisherigen Wert her.
 */
function CommitField<T>({
  label,
  value,
  onCommit,
  suffix,
  format,
  parse,
  inputMode,
  min,
  resetAfterCommit,
}: FieldProps<T> & {
  format(v: T): string;
  parse(s: string): T | null;
  inputMode?: "decimal" | "text";
}) {
  const id = useId();
  const [text, setText] = useState(() => format(value));
  const [invalid, setInvalid] = useState(false);
  // Wert von außen geändert (z. B. Rückgängig): Anzeige während des Renderns nachziehen
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(format(value));
    setInvalid(false);
  }

  const commit = () => {
    const parsed = parse(text);
    if (parsed === null || (typeof parsed === "number" && min !== undefined && parsed < min)) {
      setInvalid(true);
      setText(format(value));
      return;
    }
    setInvalid(false);
    setText(format(resetAfterCommit ? value : parsed));
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={text}
        inputMode={inputMode}
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setText(format(value));
            setInvalid(false);
          }
        }}
      />
      {suffix && <span className="field__suffix">{suffix}</span>}
    </div>
  );
}

const identity = (s: string) => s;
const trimmedText = (s: string) => (s.trim() === "" ? null : s.trim());
const degText = (v: number) => formatDeg(v).replace("°", "");

export function TextField(props: FieldProps<string>) {
  return <CommitField {...props} format={identity} parse={trimmedText} inputMode="text" />;
}

/** Ganze Millimeter; akzeptiert Dezimalwerte (gerundet) und Eingaben mit „m“. */
export function MmField(props: FieldProps<number>) {
  return (
    <CommitField suffix="mm" {...props} format={formatMm} parse={parseMm} inputMode="decimal" />
  );
}

/** Winkel auf 0,1°; Komma oder Punkt. */
export function DegField(props: FieldProps<number>) {
  return (
    <CommitField suffix="°" {...props} format={degText} parse={parseDeg} inputMode="decimal" />
  );
}

/** Millimeterfeld, das leer sein darf: leer = Standardwert (als Platzhalter angezeigt). */
export function OptionalMmField({
  label,
  value,
  fallback,
  onCommit,
  min,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  onCommit(value: number | undefined): void;
  min?: number;
}) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? "" : formatMm(value));
  const [shown, setShown] = useState(value);
  const [invalid, setInvalid] = useState(false);
  if (shown !== value) {
    setShown(value);
    setText(value === undefined ? "" : formatMm(value));
    setInvalid(false);
  }
  const commit = () => {
    if (text.trim() === "") {
      setInvalid(false);
      if (value !== undefined) onCommit(undefined);
      return;
    }
    const parsed = parseMm(text);
    if (parsed === null || (min !== undefined && parsed < min)) {
      setInvalid(true);
      setText(value === undefined ? "" : formatMm(value));
      return;
    }
    setInvalid(false);
    setText(formatMm(parsed));
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={text}
        placeholder={`${formatMm(fallback)} (Standard)`}
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setText(value === undefined ? "" : formatMm(value));
        }}
      />
      <span className="field__suffix">mm</span>
    </div>
  );
}
