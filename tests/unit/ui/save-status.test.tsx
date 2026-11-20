import { act, fireEvent, render, screen } from "@testing-library/react";
import { loadProject } from "../../../src/io/load";
import { createProjectStore } from "../../../src/store/history";
import {
  AUTOSAVE_DELAY_MS,
  createSaveController,
  RETRY_INTERVAL_MS,
} from "../../../src/store/save";
import { Workspace } from "../../../src/ui/Workspace";
import { readFixture } from "../fixtures";
import { mockApi } from "../mock-api";

function setup() {
  const files = readFixture("klein");
  const result = loadProject(files);
  if (result.status !== "ok") throw new Error();
  const server = mockApi(files);
  const store = createProjectStore(result.project);
  const save = createSaveController(store, server.api, result.contents);
  render(<Workspace store={store} save={save} />);
  return { server, store, save };
}

const status = () => screen.getByRole("status", { name: "Speicherstand" });
const rename = (name: string) => ({
  label: "Projekt umbenennen",
  run: (d: { name: string }) => void (d.name = name),
});

describe("Statusanzeige und Cmd/Strg+S (4.2)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("gespeichert → ungespeichert → gespeichert nach 2 s", async () => {
    const { store } = setup();
    expect(status()).toHaveTextContent("gespeichert");
    act(() => store.execute(rename("A")));
    expect(status()).toHaveTextContent("ungespeichert");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A");
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect(status()).toHaveTextContent(/^gespeichert$/);
  });

  test("Fehler einer Datei wird angezeigt und nach dem Wiederholversuch behoben", async () => {
    const { server, store } = setup();
    server.failing.add("projekt.yaml");
    act(() => store.execute(rename("A")));
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect(status()).toHaveTextContent("Fehler beim Speichern");
    expect(status()).toHaveAttribute("title", "projekt.yaml: schreibgeschützt");
    server.failing.clear();
    await act(() => vi.advanceTimersByTimeAsync(RETRY_INTERVAL_MS));
    expect(status()).toHaveTextContent(/^gespeichert$/);
  });

  test("Cmd/Strg+S speichert sofort", async () => {
    const { server, store } = setup();
    act(() => store.execute(rename("A")));
    await act(async () => {
      fireEvent.keyDown(window, { key: "s", metaKey: true });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(server.api.putFiles).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent(/^gespeichert$/);
  });

  test("Cmd/Strg+Z und Cmd/Strg+Shift+Z", () => {
    const { store } = setup();
    act(() => store.execute(rename("A")));
    act(() => void fireEvent.keyDown(window, { key: "z", ctrlKey: true }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Kleines Projekt");
    act(() => void fireEvent.keyDown(window, { key: "Z", ctrlKey: true, shiftKey: true }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A");
  });
});
