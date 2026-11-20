import { render, screen } from "@testing-library/react";
import { App } from "../../src/App";
import { mockApi } from "./mock-api";
import { readFixture } from "./fixtures";

test("App lädt das Projekt und zeigt Namen und Speicherstand", async () => {
  const { api } = mockApi(readFixture("klein"));
  render(<App api={api} />);
  expect(await screen.findByRole("heading", { name: "Kleines Projekt" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Speicherstand" })).toHaveTextContent("gespeichert");
});
