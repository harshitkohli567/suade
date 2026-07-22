import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "../config";

/**
 * Step-completion eval for a finished skill run (v1: Factual Background).
 * Runs on the backend, which still holds the run's raw working notes; we
 * kick it off with the runId and poll for the per-step record. It's a
 * quality read-out, never blocks the draft, and stays silent on failure.
 */

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export type StepStatus = "complete" | "partial" | "missing" | "blocked";
export type EvalVerdict = "PASS" | "FAIL" | "BLOCKED";

export interface EvalStepResult {
  step_number: number;
  step_name: string;
  status: StepStatus;
  failed_checks: string[];
  counts: Record<string, number>;
}

export interface EvalRecord {
  skillId: string;
  overall: EvalVerdict;
  summary: { complete: number; partial: number; missing: number; blocked: number; total: number };
  steps: EvalStepResult[];
}

export type EvalState =
  | { phase: "idle" }
  | { phase: "evaluating" }
  | { phase: "done"; record: EvalRecord }
  | { phase: "error"; message: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useSkillEval() {
  const [state, setState] = useState<EvalState>({ phase: "idle" });
  // Bumped on each new evaluate()/reset() so a stale in-flight poll can tell
  // it's been superseded and stop writing state.
  const runToken = useRef(0);

  useEffect(() => {
    return () => {
      runToken.current += 1; // cancel any in-flight poll on unmount
    };
  }, []);

  const evaluate = useCallback(async (runId: string) => {
    const token = ++runToken.current;
    setState({ phase: "evaluating" });

    try {
      const startResponse = await fetch(`${BACKEND_URL}/api/skill-eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      if (!startResponse.ok) {
        // e.g. no eval defined for this skill, or no working notes -- nothing
        // to show, so fall quiet rather than surfacing an error banner.
        if (token === runToken.current) setState({ phase: "idle" });
        return;
      }

      const { evalRunId } = (await startResponse.json()) as { evalRunId: string };

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        if (token !== runToken.current) return; // superseded

        const pollResponse = await fetch(`${BACKEND_URL}/api/skill-eval/${evalRunId}`);
        if (!pollResponse.ok) throw new Error(`Eval poll failed (HTTP ${pollResponse.status}).`);

        const result = (await pollResponse.json()) as
          | { status: "pending" }
          | { status: "done"; record: EvalRecord }
          | { status: "error"; error: string };

        if (token !== runToken.current) return;
        if (result.status === "done") {
          setState({ phase: "done", record: result.record });
          return;
        }
        if (result.status === "error") {
          throw new Error(result.error);
        }
      }
      throw new Error("Eval timed out.");
    } catch (err) {
      if (token !== runToken.current) return;
      console.error("Skill-eval failed:", err);
      setState({ phase: "error", message: err instanceof Error ? err.message : "Unknown eval error." });
    }
  }, []);

  const reset = useCallback(() => {
    runToken.current += 1;
    setState({ phase: "idle" });
  }, []);

  return { state, evaluate, reset };
}
