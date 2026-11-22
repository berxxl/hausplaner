import { useState, type ReactNode } from "react";
import { OPENING_DEFAULTS, OPENING_LABELS } from "../../geometry/openings";
import type { Opening } from "../../model/types";
import { DegField, MmField } from "../fields";

export function Dialog({
  title,
  children,
  canSubmit,
  onSubmit,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  canSubmit: boolean;
  onSubmit(): void;
  onCancel(): void;
}) {
  return (
    <div className="dialog-backdrop">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h2>{title}</h2>
        {children}
        <div className="dialog__buttons">
          <button type="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" disabled={!canSubmit}>
            OK
          </button>
        </div>
      </form>
    </div>
  );
}

export function RoomNameDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit(name: string): void;
  onCancel(): void;
}) {
  const [name, setName] = useState("");
  return (
    <Dialog
      title="Raum anlegen"
      canSubmit={name.trim() !== ""}
      onSubmit={() => onSubmit(name.trim())}
      onCancel={onCancel}
    >
      <div className="field">
        <label htmlFor="room-name">Name</label>
        <input id="room-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </Dialog>
  );
}

export type OpeningValues = Pick<Opening, "kind" | "offsetMm" | "widthMm" | "heightMm" | "sillMm">;

/**
 * Neue Öffnung in Rohbaumaßen. Aufgezogen: Abstand und Breite aus der Strecke; sonst Abstand aus
 * dem Klickpunkt als Mitte eines Fensters. Ein Wechsel der Art ändert den Abstand nie und die
 * Breite nur, wenn sie nicht aufgezogen wurde.
 */
export function OpeningDialog({
  centerMm,
  drawn = null,
  onSubmit,
  onCancel,
}: {
  centerMm: number;
  drawn?: { offsetMm: number; widthMm: number } | null;
  onSubmit(values: OpeningValues): void;
  onCancel(): void;
}) {
  const [kind, setKind] = useState<Opening["kind"]>("window");
  const [dims, setDims] = useState({
    ...OPENING_DEFAULTS.window,
    ...(drawn && { widthMm: drawn.widthMm }),
  });
  const [offsetMm, setOffset] = useState(
    drawn?.offsetMm ?? Math.round(centerMm - OPENING_DEFAULTS.window.widthMm / 2),
  );
  return (
    <Dialog
      title="Öffnung setzen"
      canSubmit
      onSubmit={() => onSubmit({ kind, offsetMm, ...dims })}
      onCancel={onCancel}
    >
      <div className="field">
        <label htmlFor="opening-kind">Art</label>
        <select
          id="opening-kind"
          value={kind}
          onChange={(e) => {
            const k = e.target.value as Opening["kind"];
            setKind(k);
            setDims({ ...OPENING_DEFAULTS[k], ...(drawn && { widthMm: dims.widthMm }) });
          }}
        >
          {(Object.keys(OPENING_LABELS) as Opening["kind"][]).map((k) => (
            <option key={k} value={k}>
              {OPENING_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <p className="hint">Rohbaumaße; Brüstung ab Oberkante Rohfußboden.</p>
      <MmField label="Abstand vom Wandanfang" value={offsetMm} onCommit={setOffset} />
      <MmField
        label="Breite"
        min={1}
        value={dims.widthMm}
        onCommit={(widthMm) => setDims({ ...dims, widthMm })}
      />
      <MmField
        label="Höhe"
        min={1}
        value={dims.heightMm}
        onCommit={(heightMm) => setDims({ ...dims, heightMm })}
      />
      <MmField
        label="Brüstung"
        value={dims.sillMm}
        onCommit={(sillMm) => setDims({ ...dims, sillMm })}
      />
    </Dialog>
  );
}

export function SlopeDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit(values: { heightAtBaseMm: number; angleDeg: number }): void;
  onCancel(): void;
}) {
  const [heightAtBaseMm, setHeight] = useState(1000);
  const [angleDeg, setAngle] = useState(45);
  const valid = angleDeg > 0 && angleDeg < 90;
  return (
    <Dialog
      title="Schräge anlegen"
      canSubmit={valid}
      onSubmit={() => onSubmit({ heightAtBaseMm, angleDeg })}
      onCancel={onCancel}
    >
      <p className="hint">
        Höhe ab Oberkante Rohfußboden bis Unterseite Rohschräge an der Grundlinie; steigt zur
        Raumseite an.
      </p>
      <MmField label="Höhe an der Grundlinie" value={heightAtBaseMm} onCommit={setHeight} />
      <DegField label="Neigung" value={angleDeg} onCommit={setAngle} />
    </Dialog>
  );
}

export type PenetrationMethod = "drill" | "core-drill" | "slot" | "conduit";

const PENETRATION_LABELS: Record<PenetrationMethod, string> = {
  drill: "Bohrung",
  "core-drill": "Kernbohrung",
  slot: "Schlitz",
  conduit: "Leerrohr",
};

const PENETRATION_DEFAULTS: Record<PenetrationMethod, number> = {
  drill: 40,
  "core-drill": 65,
  slot: 50,
  conduit: 25,
};

/** Durchbruch anlegen: Art und Durchmesser (design.md M3 „Durchbrüche“). */
export function PenetrationDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit(values: { method: PenetrationMethod; diameterMm: number }): void;
  onCancel(): void;
}) {
  const [method, setMethod] = useState<PenetrationMethod>("drill");
  const [diameterMm, setDiameter] = useState(PENETRATION_DEFAULTS.drill);
  const [edited, setEdited] = useState(false);
  return (
    <Dialog
      title="Durchbruch anlegen"
      canSubmit={diameterMm > 0}
      onSubmit={() => onSubmit({ method, diameterMm })}
      onCancel={onCancel}
    >
      <div className="field">
        <label htmlFor="penetration-method">Art</label>
        <select
          id="penetration-method"
          value={method}
          onChange={(e) => {
            const m = e.target.value as PenetrationMethod;
            setMethod(m);
            if (!edited) setDiameter(PENETRATION_DEFAULTS[m]);
          }}
        >
          {(Object.keys(PENETRATION_LABELS) as PenetrationMethod[]).map((m) => (
            <option key={m} value={m}>
              {PENETRATION_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <MmField
        label="Durchmesser"
        min={1}
        value={diameterMm}
        onCommit={(d) => {
          setDiameter(d);
          setEdited(true);
        }}
      />
    </Dialog>
  );
}

/** Leitung anlegen: Typ (nur passende) und Bezeichnung (design.md M3 „Leitungen“). */
export function CableDialog({
  types,
  defaultLabel,
  onSubmit,
  onCancel,
}: {
  types: { id: string; name: string }[];
  defaultLabel: string;
  onSubmit(values: { lineTypeId: string; label: string }): void;
  onCancel(): void;
}) {
  const [lineTypeId, setType] = useState(types[0]?.id ?? "");
  const [label, setLabel] = useState(defaultLabel);
  return (
    <Dialog
      title="Leitung anlegen"
      canSubmit={!!lineTypeId && label.trim() !== ""}
      onSubmit={() => onSubmit({ lineTypeId, label: label.trim() })}
      onCancel={onCancel}
    >
      <div className="field">
        <label htmlFor="cable-type">Leitungstyp</label>
        <select id="cable-type" value={lineTypeId} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="cable-label">Bezeichnung</label>
        <input id="cable-label" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
    </Dialog>
  );
}
