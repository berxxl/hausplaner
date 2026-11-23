/**
 * Abschnitt „Klimaverbindung“ in den Eigenschaften eines Klima-Innen- oder -Außengeräts
 * (design.md M6 „Klimaverbindung“). Nur Anzeige; Leitungen entstehen mit dem Werkzeug „Leitung“.
 */
import { endpointLabel, formatCableLength } from "../geometry/cables";
import { acConnection, extraLengthText } from "../geometry/refrigerant";
import type { Project } from "../model/types";
import type { Selection, ViewStore } from "../store/view";

function Link({ view, sel, children }: { view: ViewStore; sel: Selection; children: string }) {
  return (
    <button type="button" className="link" onClick={() => view.select(sel)}>
      {children}
    </button>
  );
}

export function AcConnectionInfo({
  project,
  view,
  deviceId,
}: {
  project: Project;
  view: ViewStore;
  deviceId: string;
}) {
  const conn = acConnection(project, deviceId);
  if (!conn) return null;
  const label = (id: string) => project.devices.find((d) => d.id === id)?.label ?? "?";
  const cable = (id: string) => project.cables.find((c) => c.id === id)!;
  return (
    <section className="field field--group" aria-label="Klimaverbindung">
      <h3>Klimaverbindung</h3>
      {conn.unit === "outdoor" && (
        <p className="field-info">Kältemittelverbindungen: {conn.links.length}</p>
      )}
      {conn.unit === "indoor" && conn.links.length === 0 && (
        <p className="field-info">kein Außengerät</p>
      )}
      {conn.links.map((l) => {
        const other = conn.unit === "indoor" ? l.outdoorId : l.indoorId;
        const extra = extraLengthText(l);
        return (
          <div key={l.cableId}>
            <p className="field-info">
              {conn.unit === "indoor" ? "Außengerät" : "Innengerät"}:{" "}
              <Link view={view} sel={{ kind: "device", id: other }}>
                {label(other)}
              </Link>
            </p>
            <p className="field-info">
              Kältemittelleitung:{" "}
              <Link view={view} sel={{ kind: "cable", id: l.cableId }}>
                {cable(l.cableId).label}
              </Link>{" "}
              · {formatCableLength(l.lengthMm)}
            </p>
            {extra && <p className="field-info">{extra}</p>}
          </div>
        );
      })}
      {conn.unit === "indoor" &&
        (conn.condensate.length === 0 ? (
          <p className="field-info">keine Kondensatleitung</p>
        ) : (
          conn.condensate.map((c) => (
            <p key={c.cableId} className="field-info">
              Kondensatleitung:{" "}
              <Link view={view} sel={{ kind: "cable", id: c.cableId }}>
                {cable(c.cableId).label}
              </Link>{" "}
              → {endpointLabel(project, c.drain)} · {formatCableLength(c.lengthMm)}
            </p>
          ))
        ))}
    </section>
  );
}
