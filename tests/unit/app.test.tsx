import { render, screen } from "@testing-library/react";
import { App } from "../../src/App";

test("App rendert die leere Hauptfläche", () => {
  render(<App />);
  expect(screen.getByRole("main", { name: "Hausplaner" })).toBeInTheDocument();
});
