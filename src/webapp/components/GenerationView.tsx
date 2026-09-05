import { useEffect, useRef, useState } from "react";
import { getDocTypes, pollDocumentGeneration, DocTypeInfo, GenStatus } from "../api";
import { formatEstimate } from "./DraftStep";
import SkillGraph from "./SkillGraph";

interface Props {
  runId: string;
  docTypeLabel: string;
  documentCount?: number;
  onStartOver: () => void;
}

const STATUS_ICON: Record<string, string> = {
  pending: "",
  running: "…",
  done: "✓",
  skipped: "–",
  error: "!",
};

function downloadBase64Docx(base64: string, filename: string) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GenerationView({ runId, docTypeLabel, documentCount, onStartOver }: Props) {
  const [status, setStatus] = useState<GenStatus | null>(null);
  const [docTypes, setDocTypes] = useState<DocTypeInfo[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    getDocTypes()
      .then((r) => setDocTypes(r.documentTypes))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const s = await pollDocumentGeneration(runId);
        if (stopped) return;
        setStatus(s);
        if (s.status === "running") setTimeout(poll, 2500);
      } catch {
        if (!stopped) setTimeout(poll, 4000);
      }
    };
    poll();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [runId]);

  const done = status?.status === "done";
  const failed = status?.status === "error";
  const result = status?.result || null;
  const currentDocType = docTypes.find((d) => d.id === status?.docType?.id) || null;

  return (
    <div className="card">
      <h2>{done ? docTypeLabel : `Drafting your ${docTypeLabel}…`}</h2>
      <p className="sub">
        {done
          ? "Your draft and working notes are ready below."
          : failed
          ? "The run hit an error."
          : "Suade is running each Skill in sequence and grounding it in your matter."}
      </p>

      {status && (
        <div className="estimate">
          <span>🕐</span>
          <span>
            {done
              ? `Completed in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
              : `Elapsed ${Math.floor(elapsed / 60)}m ${elapsed % 60}s · estimated ${formatEstimate(
                  status.estimateSeconds
                )}`}
          </span>
        </div>
      )}

      {currentDocType && (
        <SkillGraph docType={currentDocType} steps={status?.steps} documentCount={documentCount} />
      )}

      <div className="pipeline">
        {(status?.steps || []).map((s) => (
          <div key={s.skillId} className={`pipe-step ${s.status}`}>
            <span className="pipe-dot">{STATUS_ICON[s.status]}</span>
            <span className="pipe-label">{s.label}</span>
            <span className="pipe-meta">
              {s.status === "running"
                ? "drafting…"
                : s.status === "done" && s.seconds
                ? `${s.seconds}s`
                : s.status === "skipped"
                ? "no Skill yet"
                : s.status === "error"
                ? s.error || "error"
                : ""}
            </span>
          </div>
        ))}
      </div>

      {failed && <div className="error-banner">{status?.error}</div>}

      {done && result && (
        <div style={{ marginTop: 24 }}>
          <div className="downloads">
            <div className="dl-card">
              <div className="dl-meta">
                <div className="dl-title">Draft — {result.docTypeLabel}</div>
                <div className="dl-sub">
                  {result.draftFilename || "Not produced"}
                </div>
              </div>
              <button
                className="btn primary"
                disabled={!result.draftDocxBase64 || !result.draftFilename}
                onClick={() => downloadBase64Docx(result.draftDocxBase64!, result.draftFilename!)}
              >
                Download .docx
              </button>
            </div>

            <div className="dl-card">
              <div className="dl-meta">
                <div className="dl-title">Working Notes</div>
                <div className="dl-sub">
                  {result.workingNotesFilename || "Not produced"}
                </div>
              </div>
              <button
                className="btn secondary"
                disabled={!result.workingNotesDocxBase64 || !result.workingNotesFilename}
                onClick={() =>
                  downloadBase64Docx(result.workingNotesDocxBase64!, result.workingNotesFilename!)
                }
              >
                Download .docx
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn secondary" onClick={onStartOver}>
          ← Start a new draft
        </button>
        <span />
      </div>
    </div>
  );
}
