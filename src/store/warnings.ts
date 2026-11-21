/** Warnungen bewusst übergehen und wieder aktivieren (design.md M2 „Warnungen“). Frei von React. */
import type { Command } from "./history";

export function suppressWarning(key: string): Command {
  return {
    label: "Warnung übergehen",
    run(draft) {
      if (draft.suppressedWarnings.includes(key)) return;
      draft.suppressedWarnings.push(key);
      draft.suppressedWarnings.sort();
    },
  };
}

export function reactivateWarning(key: string): Command {
  return {
    label: "Warnung wieder aktivieren",
    run(draft) {
      draft.suppressedWarnings = draft.suppressedWarnings.filter((k) => k !== key);
    },
  };
}
