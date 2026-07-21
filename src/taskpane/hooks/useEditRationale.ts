import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "../config";
import { diffSegments, SegmentDiff } from "../utils/wordDiff";
import { readEditPairSnapshots } from "../office/editPairSweep";
import { logEditRationaleSignal } from "../editPairLog";

/**
 * After Suade inserts a draft and the lawyer edits it, this hook infers WHY
 * and surfaces a yes/no question; the answer is logged as a labeled signal.
 *
 * Trigger is POLL-based rather than the DocumentSelectionChanged event: on
 * the target Word host a second addHandlerAsync subscription never fired its
 * completion callback, so the event path was unreliable. Instead we re-read
 * each inserted draft every POLL_MS using the SAME content-control read the
 * existing sweep already uses successfully, and predict once a draft's text
 * has CHANGED from its clean baseline and then held STEADY for one poll
 * (i.e. the lawyer paused). This also avoids the parentContentControlOrNull-
 * Object dependency. Like the sweep, any failure here stays silent -- it
 * must never interrupt the lawyer's editing.
 */

const POLL_MS = 1500;

interface InsertMeta {
  baselineText: string;
  sectionId: string | null;
  sectionTitle: string | null;
  skillId: string | null;
  skillName: string | null;
  matterId: string | null;
  /** Text seen at the previous poll -- used to detect that editing has settled. */
  lastSeenText: string;
  /** Text we've already asked about, so a steady draft isn't re-predicted. */
  lastPredictedText: string | null;
}

export interface RegisterInsertArgs {
  editPairId: string;
  baselineText: string;
  sectionId: string | null;
  sectionTitle: string | null;
  skillId: string | null;
  skillName: string | null;
  matterId: string | null;
}

export type RationaleState =
  | { phase: "idle" }
  | { phase: "predicting"; sectionTitle: string | null }
  | {
      phase: "asking";
      sectionTitle: string | null;
      question: string;
      predictedRationale: string;
      category: string;
      confidence: number;
    }
  | { phase: "answered"; sectionTitle: string | null; answer: "yes" | "no" };

interface PredictResponse {
  category: string;
  subIntent: string | null;
  predictedRationale: string;
  question: string;
  confidence: number;
}

interface PendingAnswer {
  editPairId: string;
  meta: InsertMeta;
  prediction: PredictResponse;
  diffSummary: SegmentDiff["summary"];
  predictedAt: string;
}

export function useEditRationale() {
  const [state, setState] = useState<RationaleState>({ phase: "idle" });
  // Console-only breadcrumbs for the poll/predict lifecycle; safe to keep,
  // never surfaced to the lawyer.
  const note = (msg: string) => console.log("[edit-rationale]", msg);

  const registryRef = useRef<Map<string, InsertMeta>>(new Map());
  const controllerRef = useRef<AbortController | null>(null);
  const pendingAnswerRef = useRef<PendingAnswer | null>(null);
  // Guards against overlapping polls if a read or prediction runs long.
  const busyRef = useRef(false);

  const registerInsert = useCallback((args: RegisterInsertArgs) => {
    registryRef.current.set(args.editPairId, {
      baselineText: args.baselineText,
      sectionId: args.sectionId,
      sectionTitle: args.sectionTitle,
      skillId: args.skillId,
      skillName: args.skillName,
      matterId: args.matterId,
      lastSeenText: args.baselineText,
      lastPredictedText: null,
    });
    note(`tracking draft ${args.editPairId} (${args.baselineText.length} chars); watching for edits…`);
  }, []);

  // Kept in a ref so the polling effect (created once) always calls the
  // latest closure without restarting the interval on every render.
  const predictRef =
    useRef<(editPairId: string, meta: InsertMeta, currentText: string, diff: SegmentDiff) => Promise<void>>(
      async () => {}
    );
  predictRef.current = async (editPairId, meta, currentText, diff) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    note(`predicting for ${editPairId} (${diff.summary.modified}m/${diff.summary.added}a/${diff.summary.deleted}d)…`);
    setState({ phase: "predicting", sectionTitle: meta.sectionTitle });

    try {
      const response = await fetch(`${BACKEND_URL}/api/edit-rationale/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editPairId,
          sectionTitle: meta.sectionTitle,
          skillName: meta.skillName,
          before: meta.baselineText,
          after: currentText,
          diff,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Predict failed (HTTP ${response.status}).`);

      const prediction = (await response.json()) as PredictResponse;
      pendingAnswerRef.current = {
        editPairId,
        meta,
        prediction,
        diffSummary: diff.summary,
        predictedAt: new Date().toISOString(),
      };
      note(`asking: ${prediction.category} (confidence ${prediction.confidence})`);
      setState({
        phase: "asking",
        sectionTitle: meta.sectionTitle,
        question: prediction.question,
        predictedRationale: prediction.predictedRationale,
        category: prediction.category,
        confidence: prediction.confidence,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Edit-rationale predict failed:", err);
      note(`predict request failed: ${err instanceof Error ? err.message : "unknown"}`);
      setState({ phase: "idle" });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled || busyRef.current || registryRef.current.size === 0) return;
      busyRef.current = true;
      try {
        let snapshots;
        try {
          snapshots = await readEditPairSnapshots();
        } catch (err) {
          note(`snapshot read failed: ${err instanceof Error ? err.message : "unknown"}`);
          return;
        }
        const byId = new Map(snapshots.map((s) => [s.editPairId, s.text]));

        for (const [editPairId, meta] of registryRef.current) {
          const current = byId.get(editPairId);
          if (current === undefined) continue; // control not found this read
          const prev = meta.lastSeenText;
          meta.lastSeenText = current;

          if (!current.trim()) continue; // deleted / rejected insertion
          if (current !== prev) continue; // still changing -> wait for the edit to settle
          if (current === meta.baselineText) continue; // unchanged vs the inserted draft
          if (current === meta.lastPredictedText) continue; // already asked about this exact text

          const diff = diffSegments(meta.baselineText, current);
          if (diff.unchanged) continue; // only whitespace/formatting differs

          meta.lastPredictedText = current;
          await predictRef.current(editPairId, meta, current, diff);
          break; // one banner at a time
        }
      } finally {
        busyRef.current = false;
      }
    };

    note(`watching for edits (polling every ${POLL_MS}ms)`);
    const interval = window.setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      controllerRef.current?.abort();
    };
  }, []);

  const answer = useCallback((value: "yes" | "no") => {
    const pending = pendingAnswerRef.current;
    pendingAnswerRef.current = null;
    if (!pending) {
      setState({ phase: "idle" });
      return;
    }
    logEditRationaleSignal({
      editPairId: pending.editPairId,
      sectionId: pending.meta.sectionId,
      skillId: pending.meta.skillId,
      skillName: pending.meta.skillName,
      matterId: pending.meta.matterId,
      category: pending.prediction.category,
      subIntent: pending.prediction.subIntent,
      predictedRationale: pending.prediction.predictedRationale,
      question: pending.prediction.question,
      confidence: pending.prediction.confidence,
      answer: value,
      diffSummary: pending.diffSummary,
      predictedAt: pending.predictedAt,
    });
    setState({ phase: "answered", sectionTitle: pending.meta.sectionTitle, answer: value });
  }, []);

  const answerYes = useCallback(() => answer("yes"), [answer]);
  const answerNo = useCallback(() => answer("no"), [answer]);
  const dismiss = useCallback(() => {
    pendingAnswerRef.current = null;
    setState({ phase: "idle" });
  }, []);

  return { state, registerInsert, answerYes, answerNo, dismiss };
}
