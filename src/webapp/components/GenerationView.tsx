import { useEffect, useRef, useState } from "react";
import { pollDocumentGeneration, GenStatus } from "../api";
import { formatEstimate } from "./DraftStep";

interface Props {
  runId: string;
  docTypeLabel: string;
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

export default function GenerationView({ runId, docTypeLabel, onStartOver }: Props) {
  const [status, setStatus] = useState<GenStatus | null>(null);
  const [channel, setChannel] = useState<"draft" | "notes">("draft");
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

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

  function copyDraft() {
    if (!result) return;
    navigator.clipboard.writeText(result.draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

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
          <div className="channel-tabs">
            <button
              className={`channel-tab ${channel === "draft" ? "active" : ""}`}
              onClick={() => setChannel("draft")}
            >
              Draft {result.docTypeLabel}
            </button>
            <button
              className={`channel-tab ${channel === "notes" ? "active" : ""}`}
              onClick={() => setChannel("notes")}
            >
              Working Notes
            </button>
          </div>

          {channel === "draft" ? (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button className="btn secondary" onClick={copyDraft}>
                  {copied ? "Copied ✓" : "Copy draft"}
                </button>
              </div>
              <div className="draft-body">
                {result.draftSections.length > 0
                  ? result.draftSections.map((sec, i) => (
                      <div key={i}>
                        <h2>{sec.label}</h2>
                        {sec.text}
                      </div>
                    ))
                  : "(No draft text was produced.)"}
              </div>
            </>
          ) : (
            <>
              {result.workingNotesDocxBase64 && result.workingNotesFilename && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <button
                    className="btn secondary"
                    onClick={() =>
                      downloadBase64Docx(result.workingNotesDocxBase64!, result.workingNotesFilename!)
                    }
                  >
                    Download .docx
                  </button>
                </div>
              )}
              <div className="notes-body">
                {result.workingNotesInline || "(No working notes were produced.)"}
              </div>
            </>
          )}
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
