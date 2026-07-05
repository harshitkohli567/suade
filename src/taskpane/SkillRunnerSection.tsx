import React, { useState, useEffect } from "react";
import { MatterRecord, DocumentSection, DocumentRole, UploadedDocumentRecord } from "@/types";
import { SKILL_REGISTRY } from "@/data/skills/registry";
import { useSkillRunner } from "./hooks/useSkillRunner";
import { useSkillFeedback } from "./hooks/useSkillFeedback";
import { DOCUMENT_ROLES, UploadJob } from "./hooks/useDocumentUploads";
import { insertTextAtSectionEnd } from "./office/insertContent";
import UploadProgress from "./UploadProgress";

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
  const { run, output, loading, error, trace } = useSkillRunner();
  const feedback = useSkillFeedback();

  const [editedOutput, setEditedOutput] = useState("");
  const [insertState, setInsertState] = useState<"idle" | "inserting" | "done" | "error">("idle");
  const [insertError, setInsertError] = useState<string | null>(null);
  const [lastRunMeta, setLastRunMeta] = useState<RunMeta | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [traceCollapsed, setTraceCollapsed] = useState(false);

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
    }
  }, [output]);

  const selectedSkill = SKILL_REGISTRY.find((s) => s.skillId === selectedSkillId) ?? null;

  const handleRun = () => {
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
    if (!activeSection) {
      setInsertError("No active section detected -- click into a section of the document first.");
      setInsertState("error");
      return;
    }
    setInsertState("inserting");
    setInsertError(null);
    try {
      await insertTextAtSectionEnd(activeSection, editedOutput);
      setInsertState("done");
    } catch (err) {
      setInsertError(err instanceof Error ? err.message : "Unknown error inserting into document.");
      setInsertState("error");
    }
  };

  const handleDiscard = () => {
    setEditedOutput("");
    setInsertState("idle");
    setInsertError(null);
  };

  return (
    <div>
      <p style={styles.fieldLabel}>Run a Skill</p>
      <p style={styles.helperText}>
        Calls the real Claude API via the local backend (requires "npm run server" running
        separately). Not wired to the dropdown-by-section prediction yet (FR-3) -- pick any of the
        11 Skills manually for now.
      </p>

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
      <p style={styles.helperText}>
        Select any number of PDFs/DOCX relevant to this Skill (e.g. a full exhibit bundle) --
        uploads a large batch concurrently rather than one at a time. They're added to the
        matter's document set and included in every Skill run for {matter ? matter.matterId : "this matter"} from
        now on, not just this one.
      </p>

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
            accept=".pdf,.docx"
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

      <p style={styles.fieldLabel}>Message to Claude</p>
      <textarea
        style={styles.messageTextarea}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. Emphasise the passing-of-risk date and cross-reference Clause 11.2 directly."
        rows={4}
      />

      <style>{"@keyframes suade-spin { to { transform: rotate(360deg); } }"}</style>
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

      {output !== null && (
        <div style={styles.outputBox}>
          <p style={styles.outputLabel}>
            Edit this down to just the clean draft before inserting -- the full output above often
            includes working material (Gap Reports, checklists) that shouldn't land in the pleading
            itself.
          </p>
          <textarea
            style={styles.outputTextarea}
            value={editedOutput}
            onChange={(e) => setEditedOutput(e.target.value)}
            rows={14}
          />

          {lastRunMeta && (
            <div style={styles.feedbackRow}>
              <span style={styles.helperText}>Was this output helpful?</span>
              <button
                style={{
                  ...styles.voteButton,
                  ...(feedback.vote === "up" ? styles.voteButtonActiveUp : {}),
                }}
                onClick={() => feedback.submitVote({ vote: "up", ...lastRunMeta })}
                disabled={feedback.submitting}
              >
                👍
              </button>
              <button
                style={{
                  ...styles.voteButton,
                  ...(feedback.vote === "down" ? styles.voteButtonActiveDown : {}),
                }}
                onClick={() => feedback.submitVote({ vote: "down", ...lastRunMeta })}
                disabled={feedback.submitting}
              >
                👎
              </button>
              {feedback.vote && <span style={styles.successText}>Thanks, recorded.</span>}
              {feedback.error && <span style={styles.feedbackErrorText}>{feedback.error}</span>}
            </div>
          )}

          <div style={styles.insertRow}>
            <button
              style={styles.insertButton}
              onClick={handleInsert}
              disabled={insertState === "inserting" || !activeSection}
            >
              {insertState === "inserting" ? "Inserting…" : "Insert into Document"}
            </button>
            <button style={styles.discardButton} onClick={handleDiscard}>
              Discard
            </button>
          </div>

          {!activeSection && (
            <p style={styles.helperText}>
              <em>No active section detected -- click into a section of the document to enable insert.</em>
            </p>
          )}

          {insertState === "done" && (
            <p style={styles.successText}>
              Inserted as a tracked change at the end of section {activeSection?.sectionId}. Review
              it in Word (Review tab -- Track Changes) before accepting.
            </p>
          )}

          {insertState === "error" && insertError && (
            <div style={styles.errorBox}>
              <strong>Insert error:</strong> {insertError}
            </div>
          )}
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
  outputLabel: { fontSize: "11px", color: "#5B6470", margin: "0 0 6px 0", lineHeight: 1.5 },
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
  insertRow: { display: "flex", gap: "8px", marginTop: "8px" },
  insertButton: {
    fontSize: "12px",
    padding: "8px 12px",
    background: "#2C5530",
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
