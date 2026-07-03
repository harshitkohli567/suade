import { useState } from "react";

/**
 * Case Brief / Legal Theory Brief text box (Step 4 decision, 2 July 2026).
 * Several Skills' own "Required Inputs" sections name a lawyer-supplied
 * Case Brief and/or Legal Theory Brief as a hard input -- neither an
 * uploaded document nor another Skill's output. This is a single,
 * combined free-text capture for both, not a separate box per skill.
 *
 * KNOWN LIMITATION, flagged not hidden: this is in-memory React state
 * only. It resets on page reload / task-pane close and is NOT yet tied
 * to a Matter record (Matter Detection, matching FR-8, is Step 5 --
 * still to come). Wiring this to persist per-matter is follow-up work
 * once Step 5 exists, not solved here.
 */
export function useCaseNotes() {
  const [notes, setNotes] = useState("");
  return { notes, setNotes };
}
