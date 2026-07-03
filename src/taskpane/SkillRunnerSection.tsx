import React, { useState, useEffect } from "react";
import { MatterRecord, DocumentSection, UploadedDocumentRecord } from "@/types";
import { SKILL_REGISTRY } from "@/data/skills/registry";
import { useSkillRunner } from "./hooks/useSkillRunner";
import { insertTextAtSectionEnd } from "./office/insertContent";

interface SkillRunnerSectionProps {
  matter: MatterRecord | null;
  activeSection: DocumentSection | null;
  caseNotes: string;
  uploadedDocuments: UploadedDocumentRecord[];
}

const SkillRunnerSection: React.FC<SkillRunnerSectionProps> = ({
  matter,
  activeSection,
  caseNotes,
  uploadedDocuments,
}) => {
  const [selectedSkillId, setSelectedSkillId] = useState(SKILL_REGISTRY[0].skillId);
  const { run, output, loading, error } = useSkillRunner();

  const [editedOutput, setEditedOutput] = useState("");
  const [insertState, setInsertState] = useState<"idle" | "inserting" | "done" | "error">("idle");
  const [insertError, setInsertError] = useState<string | null>(null);

  useEffect(() => {
    if (output !== null) {
      setEditedOutput(output);
      setInsertState("idle");
      setInsertError(null);
    }
  }, [output]);

  const selectedSkill = SKILL_REGISTRY.find((s) => s.skillId === selectedSkillId) ?? SKILL_REGISTRY[0];

  const handleRun = () => {
    run({ skill: selectedSkill, matter, activeSection, caseNotes, uploadedDocuments });
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
        {SKILL_REGISTRY.map((skill) => (
          <option key={skill.skillId} value={skill.skillId}>
            {skill.displayName}
          </option>
        ))}
      </select>

      <p style={styles.helperText}>{selectedSkill.description}</p>

      <button style={styles.runButton} onClick={handleRun} disabled={loading}>
        {loading ? "Running…" : "Run Skill"}
      </button>

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
  select: { fontSize: "12px", padding: "4px", width: "100%", marginBottom: "6px" },
  runButton: {
    fontSize: "12px",
    padding: "8px 12px",
    background: "#1F3A5F",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "4px",
  },
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
