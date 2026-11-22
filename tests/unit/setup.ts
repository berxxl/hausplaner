import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Zustand des Strukturbaums (localStorage) nicht zwischen Tests mitnehmen
afterEach(() => {
  if (typeof window !== "undefined") window.localStorage.clear();
});
