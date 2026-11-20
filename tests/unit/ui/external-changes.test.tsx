import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../../../src/App";
import { createSession, type Session } from "../../../src/app/session";
import type { ProjectStore } from "../../../src/store/history";
import { AUTOSAVE_DELAY_MS } from "../../../src/store/save";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

async function open() {
  const server = mockApi(readFixture("klein"));
  const session = createSession(server.api);
  render(<App session={session} />);
  await screen.findByRole("heading", { name: "Kleines Projekt" });
  return { server, session };
}

function storeOf(session: Session): ProjectStore {
  const phase = session.getState().phase;
  if (phase.kind !== "open") throw new Error("Projekt nicht geöffnet");
  return phase.store;
}

const heading = () => screen.getByRole("heading", { level: 1 });
const banner = () => screen.queryByRole("region", { name: "Externe Änderungen" });
const rename = (name: string) => ({
  label: "Projekt umbenennen",
  run: (d: { name: string }) => void (d.name = name),
});

describe("Externe Änderungen (4.3)", () => {
  afterEach(() => vi.useRealTimers());

  test("nach git pull: Hinweis, Neu laden zeigt den neuen Stand", async () => {
    const { server } = await open();
    act(() =>
      server.externalWrite(
        "projekt.yaml",
        server.files()!["projekt.yaml"]!.replace("Kleines Projekt", "Nach Pull"),
      ),
    );
    expect(banner()).toHaveTextContent("projekt.yaml");
    fireEvent.click(within(banner()!).getByRole("button", { name: "Neu laden" }));
    expect(await screen.findByRole("heading", { name: "Nach Pull" })).toBeInTheDocument();
    expect(banner()).toBeNull();
  });

  test("Später: Hinweis bleibt, Autospeichern pausiert; Cmd/Strg+S schreibt erst nach Bestätigung", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { server, session } = await open();
    act(() => server.externalWrite("geschosse/eg.yaml", server.files()!["geschosse/eg.yaml"]!));
    fireEvent.click(within(banner()!).getByRole("button", { name: "Später" }));
    expect(banner()).toHaveTextContent("Autospeichern pausiert");

    act(() => storeOf(session).execute(rename("Lokal")));
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
    expect(server.api.putFiles).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    let dialog = await screen.findByRole("alertdialog", {
      name: "Externe Änderungen überschreiben?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(server.api.putFiles).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    dialog = await screen.findByRole("alertdialog", { name: "Externe Änderungen überschreiben?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Überschreiben" }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(server.api.putFiles).toHaveBeenCalledTimes(1);
    expect(banner()).toBeNull();

    // danach läuft das Autospeichern wieder
    act(() => storeOf(session).execute(rename("Weiter")));
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect(server.api.putFiles).toHaveBeenCalledTimes(2);
  });

  test("Neu laden mit ungespeicherten Änderungen fragt nach und leert die Undo-Historie", async () => {
    const { server, session } = await open();
    act(() => storeOf(session).execute(rename("Lokal")));
    expect(heading()).toHaveTextContent("Lokal");
    act(() =>
      server.externalWrite(
        "projekt.yaml",
        server.files()!["projekt.yaml"]!.replace("Kleines Projekt", "Remote"),
      ),
    );
    fireEvent.click(within(banner()!).getByRole("button", { name: "Neu laden" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Ungespeicherte Änderungen verwerfen?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Verwerfen und neu laden" }));
    expect(await screen.findByRole("heading", { name: "Remote" })).toBeInTheDocument();
    expect(storeOf(session).canUndo()).toBe(false);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(heading()).toHaveTextContent("Remote");
  });

  test("Neu laden abbrechen behält die lokalen Änderungen", async () => {
    const { server, session } = await open();
    act(() => storeOf(session).execute(rename("Lokal")));
    act(() => server.externalWrite("projekt.yaml", server.files()!["projekt.yaml"]!));
    fireEvent.click(within(banner()!).getByRole("button", { name: "Neu laden" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Abbrechen" }),
    );
    expect(heading()).toHaveTextContent("Lokal");
    expect(banner()).not.toBeNull();
  });
});
