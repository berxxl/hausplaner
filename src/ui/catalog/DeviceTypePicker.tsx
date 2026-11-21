import { useId, useMemo, useState } from "react";
import { TRADES } from "../../model/schema";
import { placeableTypes } from "../../model/devices";
import type { DeviceType } from "../../model/types";
import { TRADE_LABELS } from "../labels";

/** Auswahl eines Gerätetyps: nach Gewerk gruppiert, mit Suche, nur platzierbare Typen. */
export function DeviceTypePicker({
  types,
  value,
  onChange,
}: {
  types: DeviceType[];
  value: string | null;
  onChange(typeId: string): void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de");
    const visible = placeableTypes(types).filter(
      (t) => !q || t.name.toLocaleLowerCase("de").includes(q),
    );
    return TRADES.map((trade) => ({
      trade,
      types: visible
        .filter((t) => t.trade === trade)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    })).filter((g) => g.types.length > 0);
  }, [types, query]);
  return (
    <div className="type-picker">
      <input
        type="search"
        aria-label="Gerätetyp suchen"
        placeholder="Suchen …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <label htmlFor={id}>Gerätetyp</label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          – wählen –
        </option>
        {groups.map((g) => (
          <optgroup key={g.trade} label={TRADE_LABELS[g.trade]}>
            {g.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
