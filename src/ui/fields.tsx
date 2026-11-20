import { useId, useState } from "react";
import { formatDeg, formatMm, parseDeg, parseMm } from "../model/units";

interface FieldProps<T> {
  label: string;
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
    if (parsed === null) {
      setInvalid(true);
      setText(format(value));
      return;
    }
    setInvalid(false);
    setText(format(parsed));
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
