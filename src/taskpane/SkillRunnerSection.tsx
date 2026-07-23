import React, { useState, useEffect } from "react";
import { MatterRecord, DocumentSection, DocumentRole, UploadedDocumentRecord } from "@/types";
import { SKILL_REGISTRY } from "@/data/skills/registry";
import { useSkillRunner } from "./hooks/useSkillRunner";
import { useSkillFeedback } from "./hooks/useSkillFeedback";
import { useSkillCoach, CATEGORY_LABELS } from "./hooks/useSkillCoach";
import { DOCUMENT_ROLES, UploadJob } from "./hooks/useDocumentUploads";
import { insertTextAtSectionEnd, insertTextAtCursor } from "./office/insertContent";
import { openDocxInNewWindow } from "./office/openDocx";
import { logEditPair, newEditPairId } from "./editPairLog";
import { useEditPairSweep } from "./hooks/useEditPairSweep";
import { useEditRationale } from "./hooks/useEditRationale";
import { useSkillEval, StepStatus, EvalVerdict } from "./hooks/useSkillEval";
import UploadProgress from "./UploadProgress";

const FACTUAL_BACKGROUND_SKILL_ID = "factual-background";

const EVAL_STATUS_COLORS: Record<StepStatus, { bg: string; fg: string }> = {
  complete: { bg: "#EAF1E8", fg: "#2C5530" },
  partial: { bg: "#FFF8E6", fg: "#7A5C00" },
  missing: { bg: "#FBEAEA", fg: "#9B2C2C" },
  blocked: { bg: "#EEF0F3", fg: "#5B6470" },
};
const EVAL_STATUS_LABEL: Record<StepStatus, string> = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
  blocked: "Blocked",
};
const EVAL_VERDICT_COLORS: Record<EvalVerdict, { bg: string; fg: string }> = {
  PASS: { bg: "#2C5530", fg: "#ffffff" },
  FAIL: { bg: "#9B2C2C", fg: "#ffffff" },
  BLOCKED: { bg: "#5B6470", fg: "#ffffff" },
};

interface RunMeta {
  skillId: string;
  skillName: string;
  matterId: string | null;
  sectionId: string | null;
  documentIds: string[];
}

function formatTraceTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}

/** The Skill run whose output is currently on screen -- what Skill Coach coaches against. */
interface ActiveSkillContext {
  skillId: string;
  skillName: string;
  matterId: string | null;
  output: string;
}

interface SkillRunnerSectionProps {
  matter: MatterRecord | null;
  activeSection: DocumentSection | null;
  uploadedDocuments: UploadedDocumentRecord[];
  uploadDocuments: (files: File[], matterId: string, documentRole: DocumentRole) => Promise<void>;
  uploading: boolean;
  uploadError: string | null;
  uploadJobs: UploadJob[];
  removeDocument: (documentId: string) => Promise<void>;
  removingDocumentIds: string[];
  removeError: string | null;
}

const SkillRunnerSection: React.FC<SkillRunnerSectionProps> = ({
  matter,
  activeSection,
  uploadedDocuments,
  uploadDocuments,
  uploading,
  uploadError,
  uploadJobs,
  removeDocument,
  removingDocumentIds,
  removeError,
}) => {
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [uploadRole, setUploadRole] = useState<DocumentRole>("exhibit");
  const [message, setMessage] = useState("");
  const { run, output, workingNotes, loading, error, trace, runId, reset: resetRun } = useSkillRunner();
  const feedback = useSkillFeedback();
  const skillCoach = useSkillCoach();
  const editPairSweep = useEditPairSweep();
  const editRationale = useEditRationale();
  const runEval = useSkillEval();

  const [editedOutput, setEditedOutput] = useState("");
  const [insertState, setInsertState] = useState<"idle" | "inserting" | "done" | "error">("idle");
  const [insertError, setInsertError] = useState<string | null>(null);
  const [insertTarget, setInsertTarget] = useState<string | null>(null);
  const [notesOpenState, setNotesOpenState] = useState<"idle" | "opening" | "error">("idle");
  const [notesOpenError, setNotesOpenError] = useState<string | null>(null);
  const [inlineNotesCollapsed, setInlineNotesCollapsed] = useState(true);
  const [lastRunMeta, setLastRunMeta] = useState<RunMeta | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [activeSkillContext, setActiveSkillContext] = useState<ActiveSkillContext | null>(null);

  useEffect(() => {
    if (!loading) return;
    setElapsedSeconds(0);
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (output !== null) {
      setEditedOutput(output);
      setInsertState("idle");
      setInsertError(null);
      feedback.reset();
      if (lastRunMeta && lastRunMeta.skillId !== "none") {
        setActiveSkillContext({
          skillId: lastRunMeta.skillId,
          skillName: lastRunMeta.skillName,
          matterId: lastRunMeta.matterId,
          output,
        });
      }
      // Step-completion eval: only for skills that have one defined (v1:
      // Factual Background). Runs on the backend copy of this run, async.
      if (lastRunMeta?.skillId === FACTUAL_BACKGROUND_SKILL_ID && runId) {
        void runEval.evaluate(runId);
      }
    }
  }, [output]);

  const selectedSkill = SKILL_REGISTRY.find((s) => s.skillId === selectedSkillId) ?? null;

  const handleRun = () => {
    // A new run supersedes the previous run's eval.
    runEval.reset();

    // Snapshot any edits made in Word since the last sweep before the
    // next run changes what's on screen. Fire-and-forget.
    void editPairSweep.sweepNow();

    // Skill Coach: classify the follow-up against the PRIOR Skill output,
    // in parallel -- never delays or blocks the message's own run.
    const trimmedMessage = message.trim();
    if (activeSkillContext && trimmedMessage) {
      void skillCoach.coach({
        skillId: activeSkillContext.skillId,
        skillName: activeSkillContext.skillName,
        matterId: matter ? matter.matterId : activeSkillContext.matterId,
        priorOutput: activeSkillContext.output,
        lawyerMessage: trimmedMessage,
      });
    }

    setLastRunMeta({
      skillId: selectedSkill ? selectedSkill.skillId : "none",
      skillName: selectedSkill ? selectedSkill.displayName : "No Skill (message only)",
      matterId: matter ? matter.matterId : null,
      sectionId: activeSection ? activeSection.sectionId : null,
      documentIds: uploadedDocuments.map((d) => d.documentId),
    });
    run({ skill: selectedSkill, matter, activeSection, uploadedDocuments, message });
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!matter || !e.target.files || e.target.files.length === 0) {
      return;
    }
    const files = Array.from(e.target.files);
    e.target.value = "";
    await uploadDocuments(files, matter.matterId, uploadRole);
  };

  const handleInsert = async () => {
    setInsertState("inserting");
    setInsertError(null);
    try {
      // The id ties three things together: the corpus entry, the hidden
      // content control wrapping the inserted text, and every later
      // post-insert snapshot of that text.
      const editPairId = newEditPairId();

      // Section end when we know where we are; cursor fallback otherwise
      // (e.g. a blank document during intake has no sections yet). The
      // insert returns the RENDERED baseline text of the inserted control,
      // read the same way the sweep reads later edits -- the clean "before"
      // that edit-rationale prediction diffs against.
      let renderedBaseline: string | null = null;
      if (activeSection) {
        renderedBaseline = await insertTextAtSectionEnd(activeSection, editedOutput, editPairId);
        setInsertTarget(`at the end of section ${activeSection.sectionId}`);
      } else {
        renderedBaseline = await insertTextAtCursor(editedOutput, editPairId);
        setInsertTarget("at the cursor position");
      }
      setInsertState("done");

      // Corpus capture: the model's draft vs. what actually went into the
      // pleading. Fire-and-forget -- never blocks or fails the insert.
      if (output !== null) {
        logEditPair({
          editPairId,
          skillId: lastRunMeta ? lastRunMeta.skillId : null,
          skillName: lastRunMeta ? lastRunMeta.skillName : null,
          matterId: lastRunMeta ? lastRunMeta.matterId : null,
          sectionId: activeSection ? activeSection.sectionId : null,
          insertTarget: activeSection ? "section_end" : "cursor",
          modelDraft: output,
          finalText: editedOutput,
        });
        editPairSweep.primeBaseline(editPairId, renderedBaseline ?? editedOutput);
        // Register this draft so edit-rationale can diff post-insert edits
        // against the clean rendered baseline and predict why they happened.
        editRationale.registerInsert({
          editPairId,
          baselineText: renderedBaseline ?? editedOutput,
          sectionId: activeSection ? activeSection.sectionId : null,
          sectionTitle: activeSection ? activeSection.title : null,
          skillId: lastRunMeta ? lastRunMeta.skillId : null,
          skillName: lastRunMeta ? lastRunMeta.skillName : null,
          matterId: lastRunMeta ? lastRunMeta.matterId : null,
        });
      }
    } catch (err) {
      setInsertError(err instanceof Error ? err.message : "Unknown error inserting into document.");
      setInsertState("error");
    }
  };

  /** Fully clears the previous run so the pane returns to its pre-run state. */
  const handleDiscard = () => {
    setEditedOutput("");
    setInsertState("idle");
    setInsertError(null);
    setInsertTarget(null);
    setNotesOpenState("idle");
    setNotesOpenError(null);
    feedback.reset();
    runEval.reset();
    resetRun();
  };

  const handleOpenNotes = async () => {
    if (!workingNotes || workingNotes.kind !== "docx") return;
    setNotesOpenState("opening");
    setNotesOpenError(null);
    try {
      await openDocxInNewWindow(workingNotes.base64);
      setNotesOpenState("idle");
    } catch (err) {
      setNotesOpenError(err instanceof Error ? err.message : "Unknown error opening working notes.");
      setNotesOpenState("error");
    }
  };

  // Message composer + run button + everything that reports on a run
  // (spinner, Skill Coach, trace, errors). Rendered in one of two places:
  // below the assistant's output once there is one (chat-like flow), or in
  // the pre-output position before the first run / while a run is clearing
  // the previous output.
  const composer = (
    <>
      <p style={styles.fieldLabel}>Message to Claude</p>
      <textarea
        style={styles.messageTextarea}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Emphasise the passing-of-risk date and cross-reference Clause 11.2 directly."
        rows={4}
      />

      <div style={styles.runRow}>
        <button style={styles.runButton} onClick={handleRun} disabled={loading}>
          Enter
        </button>
        {loading && (
          <div style={styles.runningIndicator}>
            <span style={styles.spinner} />
            <span style={styles.runningText}>Running… {elapsedSeconds}s elapsed</span>
          </div>
        )}
      </div>

      {skillCoach.state.phase === "countdown" && (
        <div style={styles.coachIndicator}>
          <span style={styles.coachIndicatorText}>
            Coaching the {skillCoach.state.skillName} Skill — {CATEGORY_LABELS[skillCoach.state.category]} …
          </span>
          <button style={styles.coachStopButton} onClick={skillCoach.stop}>
            Stop
          </button>
        </div>
      )}

      {skillCoach.state.phase === "manual-review" && (
        <div style={styles.coachManualReview}>
          <span style={styles.coachManualReviewText}>
            {skillCoach.state.skillName} Skill — this touches a core rule and needs manual review
          </span>
          <button style={styles.coachDismissButton} onClick={skillCoach.dismiss}>
            ✕
          </button>
        </div>
      )}

      {skillCoach.state.phase === "committed" && (
        <div style={styles.coachToast}>
          <span style={styles.coachToastText}>
            Updated the {skillCoach.state.skillName} Skill — {skillCoach.state.diffSummary}
          </span>
          <button style={styles.coachUndoButton} onClick={() => void skillCoach.undo()}>
            Undo
          </button>
          <button style={styles.coachDismissButton} onClick={skillCoach.dismiss}>
            ✕
          </button>
        </div>
      )}

      {skillCoach.state.phase === "reverted" && (
        <div style={styles.coachToast}>
          <span style={styles.coachToastText}>Reverted the {skillCoach.state.skillName} Skill update.</span>
          <button style={styles.coachDismissButton} onClick={skillCoach.dismiss}>
            ✕
          </button>
        </div>
      )}

      {skillCoach.state.phase === "error" && (
        <div style={styles.coachManualReview}>
          <span style={styles.coachManualReviewText}>Skill Coach: {skillCoach.state.message}</span>
          <button style={styles.coachDismissButton} onClick={skillCoach.dismiss}>
            ✕
          </button>
        </div>
      )}

      {editRationale.state.phase === "predicting" && (
        <div style={styles.coachIndicator}>
          <span style={styles.coachIndicatorText}>
            Reviewing your edit
            {editRationale.state.sectionTitle ? ` to ${editRationale.state.sectionTitle}` : ""} …
          </span>
        </div>
      )}

      {editRationale.state.phase === "asking" && (
        <div style={styles.coachToast}>
          <span style={styles.coachToastText}>
            {editRationale.state.sectionTitle ? `${editRationale.state.sectionTitle} — ` : ""}
            {editRationale.state.question}
          </span>
          <button style={styles.coachUndoButton} onClick={editRationale.answerYes}>
            Yes
          </button>
          <button style={styles.coachUndoButton} onClick={editRationale.answerNo}>
            No
          </button>
          <button style={styles.coachDismissButton} onClick={editRationale.dismiss}>
            ✕
          </button>
        </div>
      )}

      {editRationale.state.phase === "answered" && (
        <div style={styles.coachToast}>
          <span style={styles.coachToastText}>Thanks — recorded.</span>
          <button style={styles.coachDismissButton} onClick={editRationale.dismiss}>
            ✕
          </button>
        </div>
      )}

      {trace.length > 0 && (
        <div style={styles.tracePanel}>
          <div style={styles.traceHeader}>
            <p style={styles.traceTitle}>Backend activity</p>
            <button style={styles.traceCollapseButton} onClick={() => setTraceCollapsed((p) => !p)}>
              {traceCollapsed ? "Show" : "Hide"}
            </button>
          </div>
          {!traceCollapsed && (
            <ul style={styles.traceList}>
              {trace.map((entry, i) => (
                <li key={i}>
                  <span style={styles.traceTime}>{formatTraceTime(entry.at)}</span> {entry.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </>
  );

  return (
    <div>
      <p style={styles.fieldLabel}>Run a Skill</p>

      <select
        style={styles.select}
        value={selectedSkillId}
        onChange={(e) => setSelectedSkillId(e.target.value)}
      >
        <option value="">-- No Skill (send message only) --</option>
        {SKILL_REGISTRY.map((skill) => (
          <option key={skill.skillId} value={skill.skillId}>
            {skill.displayName}
          </option>
        ))}
      </select>

      {selectedSkill && <p style={styles.helperText}>{selectedSkill.description}</p>}

      <p style={styles.fieldLabel}>Upload Documents for This Run</p>

      {!matter && (
        <p style={styles.helperText}>
          <em>Detect a matter above first -- uploads are scoped to a resolved matter.</em>
        </p>
      )}

      {matter && (
        <div style={styles.uploadRow}>
          <select
            style={styles.uploadRoleSelect}
            value={uploadRole}
            onChange={(e) => setUploadRole(e.target.value as DocumentRole)}
            disabled={uploading}
          >
            {DOCUMENT_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".pdf,.docx,.msg"
            multiple
            onChange={handleUploadFiles}
            style={styles.fileInput}
            disabled={uploading}
          />
        </div>
      )}

      <UploadProgress jobs={uploadJobs} />

      {uploadError && (
        <div style={styles.errorBox}>
          <strong>Upload error:</strong> {uploadError}
        </div>
      )}

      {removeError && (
        <div style={styles.errorBox}>
          <strong>Remove error:</strong> {removeError}
        </div>
      )}

      {uploadedDocuments.length > 0 && (
        <ul style={styles.documentList}>
          {uploadedDocuments.map((doc) => {
            const isRemoving = removingDocumentIds.includes(doc.documentId);
            return (
              <li key={doc.documentId} style={styles.documentListItem}>
                <span style={styles.documentListText}>
                  {doc.filename} <em>({doc.documentRole})</em>
                </span>
                <button
                  style={styles.removeButton}
                  onClick={() => removeDocument(doc.documentId)}
                  disabled={isRemoving}
                >
                  {isRemoving ? "Removing…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <style>{"@keyframes suade-spin { to { transform: rotate(360deg); } }"}</style>

      {output === null && composer}

      {output !== null && (
        <div style={styles.outputBox}>
          <div style={styles.outputTopBar}>
            <button style={styles.discardButton} onClick={handleDiscard}>
              Clear output
            </button>
          </div>
          <textarea
            style={styles.outputTextarea}
            value={editedOutput}
            onChange={(e) => setEditedOutput(e.target.value)}
            rows={14}
          />

          <div style={styles.actionRow}>
            <button
              style={styles.insertButton}
              onClick={handleInsert}
              disabled={insertState === "inserting"}
            >
              {insertState === "inserting" ? "Inserting…" : "Insert"}
            </button>
            {workingNotes && workingNotes.kind === "docx" && (
              <button style={styles.notesButton} onClick={handleOpenNotes} disabled={notesOpenState === "opening"}>
                <span style={styles.wordIcon} aria-hidden="true">W</span>
                {notesOpenState === "opening" ? "Opening…" : "Open Working Notes"}
              </button>
            )}
          </div>

          {!activeSection && (
            <p style={styles.helperText}>
              <em>No section detected -- the output will be inserted at the cursor position.</em>
            </p>
          )}

          {insertState === "done" && (
            <p style={styles.successText}>
              Inserted as a tracked change {insertTarget}. Review it in Word (Review tab -- Track
              Changes) before accepting.
            </p>
          )}

          {insertState === "error" && insertError && (
            <div style={styles.errorBox}>
              <strong>Insert error:</strong> {insertError}
            </div>
          )}

          {notesOpenState === "error" && notesOpenError && (
            <div style={styles.errorBox}>
              <strong>Working notes error:</strong> {notesOpenError}
            </div>
          )}

          {workingNotes && workingNotes.kind === "inline" && (
            <div style={styles.inlineNotesPanel}>
              <div style={styles.traceHeader}>
                <p style={styles.traceTitle}>Working notes (document generation failed -- shown inline)</p>
                <button style={styles.traceCollapseButton} onClick={() => setInlineNotesCollapsed((p) => !p)}>
                  {inlineNotesCollapsed ? "Show" : "Hide"}
                </button>
              </div>
              {!inlineNotesCollapsed && <pre style={styles.inlineNotesText}>{workingNotes.text}</pre>}
            </div>
          )}

          {runEval.state.phase === "evaluating" && (
            <div style={styles.evalPanel}>
              <div style={styles.evalHeader}>
                <span style={styles.evalTitle}>Run evaluation — step completion</span>
                <span style={styles.evalEvaluating}>Evaluating…</span>
              </div>
            </div>
          )}

          {runEval.state.phase === "error" && (
            <div style={styles.evalPanel}>
              <span style={styles.evalErrorText}>Run evaluation unavailable: {runEval.state.message}</span>
            </div>
          )}

          {runEval.state.phase === "done" && (
            <div style={styles.evalPanel}>
              <div style={styles.evalHeader}>
                <span style={styles.evalTitle}>Run evaluation — step completion</span>
                <span
                  style={{
                    ...styles.evalVerdict,
                    background: EVAL_VERDICT_COLORS[runEval.state.record.overall].bg,
                    color: EVAL_VERDICT_COLORS[runEval.state.record.overall].fg,
                  }}
                >
                  {runEval.state.record.overall}
                </span>
              </div>
              <div style={styles.evalCounts}>
                {runEval.state.record.summary.complete}/{runEval.state.record.summary.total} complete
                {runEval.state.record.summary.partial > 0 && ` · ${runEval.state.record.summary.partial} partial`}
                {runEval.state.record.summary.missing > 0 && ` · ${runEval.state.record.summary.missing} missing`}
                {runEval.state.record.summary.blocked > 0 && ` · ${runEval.state.record.summary.blocked} blocked`}
              </div>
              <table style={styles.evalTable}>
                <tbody>
                  {runEval.state.record.steps.map((s) => (
                    <tr key={s.step_number}>
                      <td style={styles.evalStepCell}>
                        {s.step_number}. {s.step_name}
                      </td>
                      <td style={styles.evalStatusCell}>
                        <span
                          style={{
                            ...styles.evalChip,
                            background: EVAL_STATUS_COLORS[s.status].bg,
                            color: EVAL_STATUS_COLORS[s.status].fg,
                          }}
                        >
                          {EVAL_STATUS_LABEL[s.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {composer}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  fieldLabel: { fontWeight: 700, color: "#5B6470", marginTop: "12px", fontSize: "13px" },
  helperText: { fontSize: "11px", color: "#5B6470", margin: "4px 0 8px 0", lineHeight: 1.5 },
  uploadRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" },
  uploadRoleSelect: { fontSize: "12px", padding: "4px" },
  fileInput: { fontSize: "12px" },
  documentList: { listStyle: "none", margin: "4px 0 8px 0", padding: 0 },
  documentListItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    fontSize: "12px",
    padding: "4px 0",
    borderBottom: "1px solid #EDEFF2",
  },
  documentListText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  removeButton: {
    fontSize: "11px",
    padding: "2px 8px",
    cursor: "pointer",
    border: "1px solid #DDE3EA",
    borderRadius: "3px",
    background: "#fff",
    color: "#5B6470",
    flexShrink: 0,
  },
  select: { fontSize: "12px", padding: "4px", width: "100%", marginBottom: "6px" },
  messageTextarea: {
    width: "100%",
    fontSize: "12px",
    fontFamily: "Segoe UI, sans-serif",
    padding: "8px",
    border: "1px solid #DDE3EA",
    borderRadius: "4px",
    boxSizing: "border-box",
    resize: "vertical",
    marginBottom: "8px",
  },
  runRow: { display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" },
  coachIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    background: "#EFF4FA",
    border: "1px solid #C5D5E8",
    borderRadius: "4px",
  },
  coachIndicatorText: { color: "#1F3A5F", flex: 1 },
  coachStopButton: {
    fontSize: "11px",
    padding: "2px 10px",
    cursor: "pointer",
    border: "1px solid #1F3A5F",
    borderRadius: "3px",
    background: "#fff",
    color: "#1F3A5F",
    flexShrink: 0,
  },
  coachManualReview: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    background: "#FFF8E6",
    border: "1px solid #E0C878",
    borderRadius: "4px",
  },
  coachManualReviewText: { color: "#7A5C00", flex: 1, lineHeight: 1.4 },
  coachToast: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    background: "#EAF1E8",
    border: "1px solid #B9D3B4",
    borderRadius: "4px",
  },
  coachToastText: { color: "#2C5530", flex: 1, lineHeight: 1.4 },
  coachUndoButton: {
    fontSize: "11px",
    padding: "2px 10px",
    cursor: "pointer",
    border: "1px solid #2C5530",
    borderRadius: "3px",
    background: "#fff",
    color: "#2C5530",
    flexShrink: 0,
  },
  coachDismissButton: {
    fontSize: "11px",
    padding: "2px 6px",
    cursor: "pointer",
    border: "none",
    background: "transparent",
    color: "#5B6470",
    flexShrink: 0,
  },
  tracePanel: {
    marginTop: "10px",
    fontSize: "11px",
    background: "#F5F7FA",
    border: "1px solid #DDE3EA",
    borderRadius: "4px",
    padding: "8px 10px",
  },
  traceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  traceTitle: { fontWeight: 700, margin: 0, color: "#5B6470" },
  traceCollapseButton: {
    fontSize: "11px",
    padding: "2px 8px",
    cursor: "pointer",
    border: "1px solid #DDE3EA",
    borderRadius: "3px",
    background: "#fff",
    color: "#5B6470",
  },
  traceList: {
    listStyle: "none",
    margin: "8px 0 0 0",
    padding: 0,
    lineHeight: 1.7,
    maxHeight: "150px",
    overflowY: "auto",
  },
  traceTime: { fontFamily: "Menlo, Consolas, monospace", color: "#8A93A0", marginRight: "6px" },
  runButton: {
    fontSize: "12px",
    padding: "8px 12px",
    background: "#1F3A5F",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  runningIndicator: { display: "flex", alignItems: "center", gap: "6px" },
  spinner: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    border: "2px solid #D9D9D9",
    borderTopColor: "#D9D9D9",
    borderRightColor: "transparent",
    animation: "suade-spin 0.7s linear infinite",
    display: "inline-block",
  },
  runningText: { fontSize: "12px", color: "#5B6470" },
  errorBox: {
    fontSize: "13px",
    background: "#FBEAEA",
    border: "1px solid #D98C8C",
    borderRadius: "4px",
    padding: "10px",
    marginTop: "10px",
  },
  outputBox: {
    marginTop: "12px",
    background: "#F5F7FA",
    border: "1px solid #DDE3EA",
    borderRadius: "4px",
    padding: "10px",
  },
  outputTopBar: { display: "flex", justifyContent: "flex-end", marginBottom: "8px" },
  actionRow: { display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" },
  wordIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    background: "#2B579A",
    color: "#fff",
    borderRadius: "3px",
    fontSize: "10px",
    fontWeight: 700,
    marginRight: "6px",
    flexShrink: 0,
  },
  outputTextarea: {
    width: "100%",
    fontSize: "12px",
    lineHeight: 1.5,
    fontFamily: "Segoe UI, sans-serif",
    padding: "8px",
    border: "1px solid #DDE3EA",
    borderRadius: "4px",
    boxSizing: "border-box",
    resize: "vertical",
  },
  feedbackRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" },
  evalPanel: {
    marginTop: "12px",
    padding: "10px 12px",
    background: "#F9FAFB",
    border: "1px solid #E2E6EB",
    borderRadius: "6px",
  },
  evalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" },
  evalTitle: { fontSize: "12px", fontWeight: 700, color: "#33404F" },
  evalVerdict: { fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "10px", letterSpacing: "0.03em" },
  evalEvaluating: { fontSize: "11px", color: "#5B6470", fontStyle: "italic" },
  evalErrorText: { fontSize: "11px", color: "#7A5C00" },
  evalCounts: { fontSize: "11px", color: "#5B6470", marginBottom: "8px" },
  evalTable: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  evalStepCell: { padding: "3px 6px 3px 0", color: "#33404F", borderTop: "1px solid #EDF0F3", lineHeight: 1.35 },
  evalStatusCell: { padding: "3px 0", textAlign: "right", borderTop: "1px solid #EDF0F3", whiteSpace: "nowrap" },
  evalChip: { fontSize: "10px", fontWeight: 600, padding: "1px 8px", borderRadius: "9px" },
  voteButton: {
    fontSize: "14px",
    padding: "2px 8px",
    cursor: "pointer",
    border: "1px solid #DDE3EA",
    borderRadius: "4px",
    background: "#fff",
  },
  voteButtonActiveUp: { background: "#EAF1E8", border: "1px solid #2C5530" },
  voteButtonActiveDown: { background: "#FBEAEA", border: "1px solid #B3261E" },
  feedbackErrorText: { fontSize: "11px", color: "#B3261E" },
  notesRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" },
  notesButton: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 600,
    padding: "8px 14px",
    background: "#EAF6EE",
    color: "#2C5530",
    border: "1px solid #A9CDB5",
    borderRadius: "4px",
    cursor: "pointer",
    flexShrink: 0,
  },
  notesFilename: {
    fontSize: "10px",
    color: "#8A93A0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  inlineNotesPanel: {
    marginTop: "8px",
    fontSize: "11px",
    background: "#FFF8E6",
    border: "1px solid #E0C878",
    borderRadius: "4px",
    padding: "8px 10px",
  },
  inlineNotesText: {
    margin: "8px 0 0 0",
    whiteSpace: "pre-wrap",
    fontFamily: "Segoe UI, sans-serif",
    fontSize: "11px",
    lineHeight: 1.5,
    maxHeight: "200px",
    overflowY: "auto",
  },
  insertRow: { display: "flex", gap: "8px", marginTop: "8px" },
  insertButton: {
    fontSize: "13px",
    fontWeight: 600,
    padding: "8px 18px",
    background: "#2B5AA6",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  discardButton: {
    fontSize: "12px",
    padding: "8px 12px",
    background: "#fff",
    color: "#5B6470",
    border: "1px solid #DDE3EA",
    borderRadius: "4px",
    cursor: "pointer",
  },
  successText: { fontSize: "12px", color: "#2C5530", marginTop: "8px", lineHeight: 1.5 },
};

export default SkillRunnerSection;
