import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../../../src/App";
import { registerMigration, unregisterMigration } from "../../../src/model/migrations";
import { readFixture, readV1Fixture } from "../fixtures";
import { mockApi } from "../mock-api";

describe("Startzustände (4.4)", () => {
  afterEach(() => unregisterMigration(0));

  test("Fehlerseite bei Ladefehler; nach Korrektur der Datei lädt die App automatisch", async () => {
    const files = readFixture("klein");
    const good = files["geschosse/eg.yaml"]!;
    files["geschosse/eg.yaml"] = "<<<<<<< HEAD\n" + good;
    const server = mockApi(files);
    render(<App api={server.api} />);
    const list = await screen.findByRole("list", { name: "Ladefehler" });
    expect(list).toHaveTextContent("geschosse/eg.yaml, Zeile 1: Merge-Konfliktmarker");
    act(() => server.externalWrite("geschosse/eg.yaml", good));
    expect(await screen.findByRole("heading", { name: "Kleines Projekt" })).toBeInTheDocument();
    expect(server.api.putFiles).not.toHaveBeenCalled();
  });

  test("neuere Schemaversion: Fehlerseite mit Hinweis auf neuere App-Version", async () => {
    const files = readFixture("klein");
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 2", "schemaVersion: 9");
    render(<App api={mockApi(files).api} />);
    expect(await screen.findByRole("list", { name: "Ladefehler" })).toHaveTextContent(
      "Projekt wurde mit neuerer App-Version erstellt",
    );
  });

  test("fehlender Ordner: Anlegen schreibt sofort projekt.yaml, katalog.yaml und geschosse/eg.yaml mit Standardwerten", async () => {
    const server = mockApi("missing", "haus-daten");
    render(<App api={server.api} />);
    const form = await screen.findByRole("form", { name: "Neues Projekt" });
    expect(form).toHaveTextContent("Der Ordner „haus-daten“ existiert nicht");
    expect(within(form).getByLabelText("Projektname")).toHaveValue("haus-daten");
    fireEvent.click(within(form).getByRole("button", { name: "Anlegen" }));
    expect(await screen.findByRole("heading", { name: "haus-daten" })).toBeInTheDocument();
    const written = server.files()!;
    expect(Object.keys(written).sort()).toEqual([
      "geschosse/eg.yaml",
      "katalog.yaml",
      "projekt.yaml",
    ]);
    expect(written["projekt.yaml"]).toBe(
      'schemaVersion: 2\nname: "haus-daten"\nsettings:\n  northDeg: 0\n  installZones:\n    horizontalTop: [150, 450]\n    horizontalBottom: [150, 450]\n    verticalFromEdge: [100, 300]\n',
    );
    expect(written["katalog.yaml"]).toMatch(/- id: "presence-knx"\n {4}name: "Präsenzmelder KNX"/);
    expect(written["geschosse/eg.yaml"]).toMatch(
      /name: "EG"\n {2}slug: "eg"\n {2}elevationMm: 0\n {2}rawHeightMm: 2500\n {2}defaults: \{floorBuildupMm: 120, plasterMm: 15, suspendedMm: 0\}\n$/,
    );
  });

  test("Ordner nur mit katalog.yaml gilt als leer; Anlegen lässt katalog.yaml unberührt", async () => {
    const server = mockApi({ "katalog.yaml": "deviceTypes: []\n" });
    render(<App api={server.api} />);
    const form = await screen.findByRole("form", { name: "Neues Projekt" });
    expect(form).toHaveTextContent("liegt noch kein Projekt");
    fireEvent.click(within(form).getByRole("button", { name: "Anlegen" }));
    await screen.findByRole("heading", { name: "haus-daten" });
    expect(server.files()!["katalog.yaml"]).toBe("deviceTypes: []\n");
    expect(Object.keys(server.api.putFiles.mock.calls[0]![0]).sort()).toEqual([
      "geschosse/eg.yaml",
      "projekt.yaml",
    ]);
  });

  test("Ablehnen schreibt nichts und zeigt nur den Hinweis", async () => {
    const server = mockApi({});
    render(<App api={server.api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Nicht anlegen" }));
    expect(screen.getByRole("note")).toHaveTextContent("Kein Projekt angelegt");
    expect(server.api.putFiles).not.toHaveBeenCalled();
  });

  test("nach Migration erscheint der Hinweis", async () => {
    registerMigration(0, (f) => ({
      ...f,
      "projekt.yaml": { schemaVersion: 1, ...(f["projekt.yaml"] as object) },
    }));
    const files = readV1Fixture("klein");
    files["projekt.yaml"] = files["projekt.yaml"]!.replace("schemaVersion: 1\n", "");
    render(<App api={mockApi(files).api} />);
    expect(await screen.findByRole("region", { name: "Hinweis" })).toHaveTextContent(
      "Projekt auf Version 2 aktualisiert, wird beim nächsten Speichern geschrieben",
    );
  });
});
