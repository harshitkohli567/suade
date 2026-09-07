import { useEffect, useRef, useState } from "react";
import { getDocTypes, pollDocumentGeneration, DocTypeInfo, GenStatus, GenStep } from "../api";
import { formatEstimate } from "./DraftStep";
import SkillGraph from "./SkillGraph";
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FileNotesIcon,
  FileTextIcon,
  SpinnerIcon,
} from "./Icons";

interface Props {
  runId: string;
  docTypeLabel: string;
  documentCount?: number;
  onStartOver: () => void;
}

function StepMark({ status }: { status: GenStep["status"] }) {
  if (status === "done") return <CheckIcon size={13} />;
  if (status === "running") return <SpinnerIcon size={14} />;
  if (status === "error") return <AlertIcon size={14} />;
  if (status === "skipped") return <span>–</span>;
  return null;
}

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
  const mmss = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div className="card">
      <h2>{done ? docTypeLabel : `Drafting your ${docTypeLabel}…`}</h2>
      <p className="sub">
        {done
          ? "Your draft and working notes are ready below."
          : failed
          ? "The run hit an error."
          : "Suade is running each skill in sequence and grounding it in your matter."}
      </p>

      {status && (
        <div className="banner info" style={{ marginBottom: 16 }}>
          <ClockIcon size={16} />
          <span>
            {done
              ? `Completed in ${mmss}`
              : `Elapsed ${mmss} · estimated ${formatEstimate(status.estimateSeconds)}`}
          </span>
        </div>
      )}

      {currentDocType && (
        <SkillGraph docType={currentDocType} steps={status?.steps} documentCount={documentCount} />
      )}

      <div className="pipeline">
        {(status?.steps || []).map((s) => (
          <div key={s.skillId} className={`pipe-step ${s.status}`}>
            <span className="pipe-dot">
              <StepMark status={s.status} />
            </span>
            <span className="pipe-label">{s.label}</span>
            <span className="pipe-meta">
              {s.status === "running"
                ? "drafting…"
                : s.status === "done" && s.seconds
                ? `${s.seconds}s`
                : s.status === "skipped"
                ? "no skill yet"
                : s.status === "error"
                ? s.error || "error"
                : ""}
            </span>
          </div>
        ))}
      </div>

      {failed && (
        <div className="error-banner">
          <AlertIcon size={16} />
          <span>{status?.error}</span>
        </div>
      )}

      {done && result && (
        <div className="downloads">
          <div className="dl-card">
            <span className="dl-icon">
              <FileTextIcon size={20} />
            </span>
            <div className="dl-meta">
              <div className="dl-title">Draft — {result.docTypeLabel}</div>
              <div className="dl-sub">{result.draftFilename || "Not produced"}</div>
            </div>
            <button
              className="btn primary"
              disabled={!result.draftDocxBase64 || !result.draftFilename}
              onClick={() => downloadBase64Docx(result.draftDocxBase64!, result.draftFilename!)}
            >
              <DownloadIcon size={16} />
              Download
            </button>
          </div>

          <div className="dl-card">
            <span className="dl-icon">
              <FileNotesIcon size={20} />
            </span>
            <div className="dl-meta">
              <div className="dl-title">Working notes</div>
              <div className="dl-sub">{result.workingNotesFilename || "Not produced"}</div>
            </div>
            <button
              className="btn secondary"
              disabled={!result.workingNotesDocxBase64 || !result.workingNotesFilename}
              onClick={() =>
                downloadBase64Docx(result.workingNotesDocxBase64!, result.workingNotesFilename!)
              }
            >
              <DownloadIcon size={16} />
              Download
            </button>
          </div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn secondary" onClick={onStartOver}>
          <ArrowLeftIcon size={16} />
          Start a new draft
        </button>
        <span />
      </div>
    </div>
  );
}
