import React, { useState } from "react";
import { useDocumentContext } from "./hooks/useDocumentContext";
import { useSectionDebug } from "./hooks/useSectionDebug";
import { useMatterDetection } from "./hooks/useMatterDetection";
import { useDocumentUploads } from "./hooks/useDocumentUploads";
import SkillRunnerSection from "./SkillRunnerSection";
import BackendStatus from "./BackendStatus";

const App: React.FC = () => {
  const { context, error } = useDocumentContext();
  const debug = useSectionDebug();
  const matterDetection = useMatterDetection();
  const documentUploads = useDocumentUploads();
  const boldSignals = debug.signals.filter((s) => s.bold);
  const highMatch = matterDetection.results.find((r) => r.confidence === "high");
  const [matterCardCollapsed, setMatterCardCollapsed] = useState(false);
  const [diagnosticsCollapsed, setDiagnosticsCollapsed] = useState(false);

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Suade</h1>
      <p style={styles.subheading}>Live document context — Phase 1, Step 5.</p>

      <BackendStatus />

      {error && (
        <div style={styles.errorBox}>
          <strong>Error reading document:</strong> {error}
        </div>
      )}

      {!error && !context && <p style={styles.body}>Reading document context…</p>}

      {context && (
        <dl style={styles.fieldList}>
          <dt style={styles.fieldLabel}>Paragraph index</dt>
          <dd style={styles.fieldValue}>
            {context.paragraphIndex >= 0 ? context.paragraphIndex : "(none detected)"}
          </dd>

          <dt style={styles.fieldLabel}>Active section</dt>
          <dd style={styles.fieldValue}>
            {context.activeSection ? (
              <>
                <strong>{context.activeSection.sectionId}</strong> — {context.activeSection.title}
              </>
            ) : (
              <em>(none — outside any recognized section, e.g. cover page)</em>
            )}
          </dd>
        </dl>
      )}

      <hr style={styles.divider} />

      <p style={styles.fieldLabel}>Matter Detection</p>
      <button style={styles.debugButton} onClick={matterDetection.run} disabled={matterDetection.loading}>
        {matterDetection.loading ? "Detecting…" : "Detect Matter"}
      </button>

      {matterDetection.error && (
        <div style={styles.errorBox}>
          <strong>Matter detection error:</strong> {matterDetection.error}
        </div>
      )}

      {highMatch && (
        <div style={styles.matterCard}>
          <div style={styles.matterCardHeader}>
            <p style={styles.matterCardTitle}>
              {matterCardCollapsed ? highMatch.matter.matterId : "Resolved Matter"}
            </p>
            <button
              style={styles.collapseButton}
              onClick={() => setMatterCardCollapsed((prev) => !prev)}
            >
              {matterCardCollapsed ? "Show" : "Hide"}
            </button>
          </div>

          {!matterCardCollapsed && (
            <dl style={styles.fieldList}>
              <dt style={styles.fieldLabel}>Matter ID</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.matterId}</dd>
              <dt style={styles.fieldLabel}>Client</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.client}</dd>
              <dt style={styles.fieldLabel}>Represented side</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.representedSide}</dd>
              <dt style={styles.fieldLabel}>Counterparty</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.counterparty}</dd>
              <dt style={styles.fieldLabel}>Matter type</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.matterType}</dd>
              <dt style={styles.fieldLabel}>Governing law</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.governingLaw}</dd>
              <dt style={styles.fieldLabel}>Institution / seat</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.institutionSeat}</dd>
              <dt style={styles.fieldLabel}>Responsible team</dt>
              <dd style={styles.fieldValue}>{highMatch.matter.responsibleLawyerTeam}</dd>
            </dl>
          )}
        </div>
      )}

      {!highMatch && matterDetection.hasRun && (
        <p style={styles.body}>No matter detected in this document.</p>
      )}

      <hr style={styles.divider} />

      <SkillRunnerSection
        matter={highMatch ? highMatch.matter : null}
        activeSection={context ? context.activeSection : null}
        uploadedDocuments={highMatch ? documentUploads.documentsForMatter(highMatch.matter.matterId) : []}
        uploadDocuments={documentUploads.uploadDocuments}
        uploading={documentUploads.uploading}
        uploadError={documentUploads.uploadError}
        uploadJobs={documentUploads.uploadJobs}
      />

      <hr style={styles.divider} />

      <button style={styles.debugButton} onClick={debug.run} disabled={debug.loading}>
        {debug.loading ? "Running diagnostics…" : "Run section-detection diagnostics"}
      </button>

      {debug.error && (
        <div style={styles.errorBox}>
          <strong>Diagnostics error:</strong> {debug.error}
        </div>
      )}

      {debug.sections.length > 0 || boldSignals.length > 0 ? (
        <div style={styles.debugPanel}>
          <div style={styles.matterCardHeader}>
            <p style={styles.debugHeading}>
              Sections detected: {debug.sections.length} | Bold paragraphs found: {boldSignals.length}
            </p>
            <button
              style={styles.collapseButton}
              onClick={() => setDiagnosticsCollapsed((prev) => !prev)}
            >
              {diagnosticsCollapsed ? "Show" : "Hide"}
            </button>
          </div>

          {!diagnosticsCollapsed && (
            <>
              <p style={styles.debugSubheading}>Detected sections:</p>
              <ul style={styles.debugList}>
                {debug.sections.map((s) => (
                  <li key={s.sectionId}>
                    <strong>{s.sectionId}</strong> [{s.startParagraphIndex}–{s.endParagraphIndex}] —{" "}
                    {s.title}
                  </li>
                ))}
              </ul>

              <p style={styles.debugSubheading}>All bold paragraphs (raw signal):</p>
              <ul style={styles.debugList}>
                {boldSignals.map((s) => (
                  <li key={s.index}>
                    #{s.index} size={s.fontSize ?? "null"} listItem={String(s.isListItem)} —{" "}
                    {s.text.slice(0, 60)}
                    {s.text.length > 60 ? "…" : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        debug.signals.length > 0 && (
          <p style={styles.body}>
            Diagnostics ran but found 0 bold paragraphs — this itself is useful information, tell
            Claude this exact result.
          </p>
        )
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: "Segoe UI, sans-serif", padding: "16px", color: "#1a1a1a" },
  heading: { fontSize: "20px", fontWeight: 700, color: "#1F3A5F", margin: "0 0 4px 0" },
  subheading: { fontSize: "13px", color: "#5B6470", margin: "0 0 16px 0" },
  body: { fontSize: "13px", lineHeight: 1.5 },
  errorBox: {
    fontSize: "13px",
    background: "#FBEAEA",
    border: "1px solid #D98C8C",
    borderRadius: "4px",
    padding: "10px",
    marginBottom: "12px",
  },
  fieldList: { fontSize: "13px", margin: 0 },
  fieldLabel: { fontWeight: 700, color: "#5B6470", marginTop: "12px" },
  fieldValue: { margin: "4px 0 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  helperText: { fontSize: "11px", color: "#5B6470", margin: "4px 0 8px 0", lineHeight: 1.5 },
  divider: { margin: "20px 0", border: "none", borderTop: "1px solid #E0E0E0" },
  debugButton: {
    fontSize: "12px",
    padding: "8px 12px",
    background: "#1F3A5F",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "8px",
  },
  matterCard: {
    marginTop: "12px",
    background: "#EAF1E8",
    border: "1px solid #B9D3B4",
    borderRadius: "4px",
    padding: "10px",
  },
  matterCardTitle: { fontWeight: 700, margin: 0, color: "#2C5530" },
  matterCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  collapseButton: {
    fontSize: "11px",
    padding: "2px 8px",
    cursor: "pointer",
    border: "1px solid #B9D3B4",
    borderRadius: "3px",
    background: "#fff",
    color: "#2C5530",
  },
  debugPanel: {
    marginTop: "12px",
    fontSize: "11px",
    background: "#F5F7FA",
    border: "1px solid #DDE3EA",
    borderRadius: "4px",
    padding: "10px",
    maxHeight: "300px",
    overflowY: "auto",
  },
  debugHeading: { fontWeight: 700, margin: "0 0 8px 0" },
  debugSubheading: { fontWeight: 700, margin: "10px 0 4px 0", color: "#5B6470" },
  debugList: { margin: 0, paddingLeft: "18px", lineHeight: 1.6 },
};

export default App;
