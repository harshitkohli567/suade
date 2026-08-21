import React, { useEffect, useRef, useState } from "react";
import { DocumentRole, MatterRecord, UploadedDocumentRecord } from "@/types";
import {
  DetectedContext,
  SKILL_LIBRARY,
  isDraftingSkill,
  skillDisplayName,
} from "@/data/sections/sectionTasks";
import { UploadJob } from "./hooks/useDocumentUploads";
import UploadProgress from "./UploadProgress";

interface TaskDetectedCardProps {
  context: DetectedContext;
  matter: MatterRecord | null;
  uploadedDocuments: UploadedDocumentRecord[];
  uploadDocuments: (files: File[], matterId: string, documentRole: DocumentRole) => Promise<void>;
  uploading: boolean;
  uploadJobs: UploadJob[];
  uploadError: string | null;
  removeDocument: (documentId: string) => Promise<void>;
  removingDocumentIds: string[];
  removeError: string | null;
  /** The first drafting skill selected -- what a run should execute. */
  onPrimarySkillChange: (skillId: string | null) => void;
}

interface FieldState {
  value: string;
  confirmed: boolean;
}

const field = (value: string): FieldState => ({ value, confirmed: false });

const TaskDetectedCard: React.FC<TaskDetectedCardProps> = ({
  context,
  matter,
  uploadedDocuments,
  uploadDocuments,
  uploading,
  uploadJobs,
  uploadError,
  removeDocument,
  removingDocumentIds,
  removeError,
  onPrimarySkillChange,
}) => {
  const sourcesDefault = context.sources;

  const [task, setTask] = useState<FieldState>(field(context.task));
  const [goal, setGoal] = useState<FieldState>(field(context.goal));
  const [sources, setSources] = useState<FieldState>(field(sourcesDefault));
  const [assumptions, setAssumptions] = useState<FieldState>(field(context.assumptions));
  const [skillIds, setSkillIds] = useState<string[]>(context.skillIds);

  const [skillQuery, setSkillQuery] = useState("");
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  // Re-seed all fields when the detected SECTION changes -- but not on every
  // render, so edits within a section aren't clobbered.
  const seededSection = useRef<string | null>(null);
  useEffect(() => {
    if (seededSection.current === context.sectionId) return;
    seededSection.current = context.sectionId;
    setTask(field(context.task));
    setGoal(field(context.goal));
    setSources(field(context.sources));
    setAssumptions(field(context.assumptions));
    setSkillIds(context.skillIds);
    setSkillQuery("");
  }, [context]);

  // Report the primary drafting skill (first drafting skill selected) upward.
  useEffect(() => {
    onPrimarySkillChange(skillIds.find(isDraftingSkill) ?? null);
  }, [skillIds, onPrimarySkillChange]);

  const addSkill = (skillId: string) => {
    setSkillIds((prev) => (prev.includes(skillId) ? prev : [...prev, skillId]));
    setSkillQuery("");
  };
  const removeSkill = (skillId: string) => setSkillIds((prev) => prev.filter((id) => id !== skillId));

  const filteredLibrary = SKILL_LIBRARY.filter(
    (s) =>
      !skillIds.includes(s.skillId) &&
      s.displayName.toLowerCase().includes(skillQuery.trim().toLowerCase())
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!matter || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    e.target.value = "";
    const role: DocumentRole = context.requiredDocumentRoles[0] ?? "exhibit";
    await uploadDocuments(files, matter.matterId, role);
  };

  const Confirm: React.FC<{ on: boolean; onToggle: () => void; label: string }> = ({ on, onToggle, label }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `${label} confirmed` : `Confirm ${label}`}
      title={on ? "Confirmed" : "Confirm"}
      style={{ ...s.check, ...(on ? s.checkOn : {}) }}
    >
      {on ? "✓" : ""}
    </button>
  );

  return (
    <div style={s.card}>
      <p style={s.label}>Section</p>
      <p style={s.sectionTitle}>{context.sectionTitle}</p>

      <p style={s.label}>Task</p>
      <div style={s.fieldRow}>
        <input
          style={s.input}
          value={task.value}
          onChange={(e) => setTask({ value: e.target.value, confirmed: false })}
        />
        <Confirm on={task.confirmed} onToggle={() => setTask((f) => ({ ...f, confirmed: !f.confirmed }))} label="Task" />
      </div>

      <p style={s.contextHeader}>Context Assembled</p>

      <p style={s.label}>Skills</p>
      <div style={s.fieldRow}>
        <div
          style={s.combobox}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            setSkillMenuOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setSkillMenuOpen(false), 120);
          }}
        >
          <div style={s.chipWrap}>
            {skillIds.map((id) => (
              <span key={id} style={{ ...s.chip, ...(isDraftingSkill(id) ? {} : s.chipFormatting) }}>
                {skillDisplayName(id)}
                <button type="button" style={s.chipX} onClick={() => removeSkill(id)} aria-label={`Remove ${skillDisplayName(id)}`}>
                  ×
                </button>
              </span>
            ))}
            <input
              style={s.chipInput}
              value={skillQuery}
              placeholder={skillIds.length === 0 ? "Add skill…" : ""}
              onChange={(e) => {
                setSkillQuery(e.target.value);
                setSkillMenuOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredLibrary.length > 0) {
                  e.preventDefault();
                  addSkill(filteredLibrary[0].skillId);
                } else if (e.key === "Backspace" && skillQuery === "" && skillIds.length > 0) {
                  removeSkill(skillIds[skillIds.length - 1]);
                }
              }}
            />
          </div>
          {skillMenuOpen && filteredLibrary.length > 0 && (
            <ul style={s.menu}>
              {filteredLibrary.slice(0, 8).map((item) => (
                <li key={item.skillId}>
                  <button type="button" style={s.menuItem} onMouseDown={(e) => e.preventDefault()} onClick={() => addSkill(item.skillId)}>
                    <span>{item.displayName}</span>
                    <span style={s.menuKind}>{item.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Confirm
          on={skillIds.length > 0}
          onToggle={() => {}}
          label="Skills"
        />
      </div>

      <p style={s.label}>Goal</p>
      <div style={s.fieldRow}>
        <input
          style={s.input}
          value={goal.value}
          onChange={(e) => setGoal({ value: e.target.value, confirmed: false })}
        />
        <Confirm on={goal.confirmed} onToggle={() => setGoal((f) => ({ ...f, confirmed: !f.confirmed }))} label="Goal" />
      </div>

      <p style={s.label}>Sources</p>
      <div style={s.fieldRow}>
        <input
          style={s.input}
          value={sources.value}
          onChange={(e) => setSources({ value: e.target.value, confirmed: false })}
        />
        <Confirm on={sources.confirmed} onToggle={() => setSources((f) => ({ ...f, confirmed: !f.confirmed }))} label="Sources" />
      </div>

      {/* Uploaded files + upload control. */}
      <div style={s.uploadArea}>
        {uploadedDocuments.map((doc) => {
          const removing = removingDocumentIds.includes(doc.documentId);
          return (
            <span key={doc.documentId} style={s.fileChip}>
              {doc.filename}
              <button
                type="button"
                style={s.chipX}
                disabled={removing}
                onClick={() => removeDocument(doc.documentId)}
                aria-label={`Remove ${doc.filename}`}
              >
                {removing ? "…" : "×"}
              </button>
            </span>
          );
        })}
        <label style={{ ...s.uploadButton, ...(matter && !uploading ? {} : s.uploadButtonDisabled) }}>
          {uploading ? "Uploading…" : "Upload documents"}
          <input
            type="file"
            accept=".pdf,.docx,.msg"
            multiple
            disabled={!matter || uploading}
            onChange={handleUpload}
            style={s.hiddenFile}
          />
        </label>
      </div>

      {!matter && <p style={s.hint}>Set a Matter ID above to enable uploads.</p>}
      <UploadProgress jobs={uploadJobs} />
      {uploadError && <p style={s.errText}>Upload error: {uploadError}</p>}
      {removeError && <p style={s.errText}>Remove error: {removeError}</p>}

      <p style={s.label}>Assumptions</p>
      <div style={s.fieldRow}>
        <input
          style={s.input}
          value={assumptions.value}
          onChange={(e) => setAssumptions({ value: e.target.value, confirmed: false })}
        />
        <Confirm
          on={assumptions.confirmed}
          onToggle={() => setAssumptions((f) => ({ ...f, confirmed: !f.confirmed }))}
          label="Assumptions"
        />
      </div>
    </div>
  );
};

const NAVY = "#1F3A5F";
const ACCENT = "#2B5AA6"; // blue confirm/accent, matches the pane's Insert button
const INK = "#33404F";
const INK_SOFT = "#5B6470";
const LINE = "#DDE3EA";
const CHECK_BORDER = "#C3CCD6";
const CRIMSON = "#B3261E";

const s: Record<string, React.CSSProperties> = {
  card: {
    background: "#FFFFFF",
    border: `1px solid ${LINE}`,
    borderRadius: "8px",
    padding: "14px 14px 16px",
  },
  label: { fontSize: "12px", color: INK_SOFT, margin: "10px 0 4px", fontWeight: 600 },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: NAVY,
    letterSpacing: "0.01em",
    margin: "0 0 2px",
    textTransform: "uppercase",
  },
  contextHeader: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: INK_SOFT,
    margin: "16px 0 6px",
  },
  fieldRow: { display: "flex", alignItems: "center", gap: "8px" },
  input: {
    flex: 1,
    fontSize: "13px",
    color: INK,
    padding: "8px 10px",
    border: `1px solid ${LINE}`,
    borderRadius: "4px",
    outline: "none",
    boxSizing: "border-box",
    minWidth: 0,
  },
  check: {
    width: "18px",
    height: "18px",
    flexShrink: 0,
    border: `1.5px solid ${CHECK_BORDER}`,
    borderRadius: "4px",
    background: "#fff",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  checkOn: { background: ACCENT, color: "#fff", borderColor: ACCENT },
  combobox: {
    flex: 1,
    position: "relative",
    border: `1px solid ${LINE}`,
    borderRadius: "4px",
    padding: "4px 5px",
    minWidth: 0,
  },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: NAVY,
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    padding: "4px 8px",
    borderRadius: "4px",
  },
  chipFormatting: { background: "#E1E8F0", color: NAVY },
  chipX: {
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: 1,
    padding: 0,
  },
  chipInput: {
    border: "none",
    outline: "none",
    fontSize: "13px",
    padding: "4px",
    flex: 1,
    minWidth: "80px",
    color: INK,
    background: "transparent",
  },
  menu: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    zIndex: 20,
    listStyle: "none",
    margin: 0,
    padding: "4px",
    background: "#fff",
    border: `1px solid ${LINE}`,
    borderRadius: "6px",
    boxShadow: "0 8px 22px -12px rgba(31,58,95,0.35)",
    maxHeight: "220px",
    overflowY: "auto",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "13px",
    color: INK,
    padding: "7px 8px",
    borderRadius: "4px",
    textAlign: "left",
  },
  menuKind: { fontSize: "10px", color: INK_SOFT, textTransform: "uppercase", letterSpacing: "0.06em" },
  docChipWrap: { display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0 0" },
  docSourceChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "#EEF3F9",
    color: NAVY,
    border: `1px solid ${LINE}`,
    fontSize: "12px",
    fontWeight: 600,
    padding: "4px 8px",
    borderRadius: "4px",
  },
  fromDoc: {
    fontSize: "10px",
    fontWeight: 500,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  uploadArea: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", margin: "10px 0 0" },
  fileChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "#EEF0F3",
    color: INK,
    fontSize: "12px",
    padding: "5px 9px",
    borderRadius: "4px",
  },
  uploadButton: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 600,
    color: ACCENT,
    border: `1px solid ${ACCENT}`,
    borderRadius: "4px",
    padding: "7px 12px",
    cursor: "pointer",
    background: "#fff",
  },
  uploadButtonDisabled: { color: "#A9B2BC", borderColor: LINE, cursor: "not-allowed" },
  hiddenFile: { display: "none" },
  hint: { fontSize: "11px", color: INK_SOFT, margin: "6px 0 0", fontStyle: "italic" },
  errText: { fontSize: "11px", color: CRIMSON, margin: "6px 0 0" },
};

export default TaskDetectedCard;
