import { useEffect, useState } from "react";
import { getDocTypes, DocTypeInfo } from "../api";
import SkillGraph from "./SkillGraph";
import { AlertIcon, ArrowLeftIcon, ChevronDownIcon, InfoIcon, SparkleIcon, WarningIcon } from "./Icons";

interface Props {
  documentType: string;
  setDocumentType: (id: string) => void;
  instructions: string;
  setInstructions: (s: string) => void;
  documentCount?: number;
  onBack: () => void;
  onGenerate: () => void;
}

export function formatEstimate(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `about ${mins} minute${mins === 1 ? "" : "s"}`;
}

export default function DraftStep({
  documentType,
  setDocumentType,
  instructions,
  setInstructions,
  documentCount,
  onBack,
  onGenerate,
}: Props) {
  const [docTypes, setDocTypes] = useState<DocTypeInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocTypes()
      .then((r) => setDocTypes(r.documentTypes))
      .catch((e) => setError((e as Error).message));
  }, []);

  const selected = docTypes.find((d) => d.id === documentType) || null;

  return (
    <div className="card">
      <h2>Generate a draft</h2>
      <p className="sub">
        Choose the document to draft. Suade runs the matching skills in sequence, grounded in your matter.
      </p>

      <label className="field">
        <span className="lbl">Document type</span>
        <span className="select-wrap">
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            <option value="" disabled>
              Select a document…
            </option>
            {docTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon size={16} className="chev" />
        </span>
      </label>

      {selected && (
        <>
          <div className="banner info" style={{ marginBottom: 14 }}>
            <InfoIcon size={16} />
            <span>
              {selected.skills.length} skills will run in sequence · estimated{" "}
              {formatEstimate(selected.estimateSeconds)}
            </span>
          </div>

          <SkillGraph docType={selected} documentCount={documentCount} />

          <div className="pipeline">
            {selected.skills.map((s, i) => (
              <div key={s.id} className="pipe-step">
                <span className="pipe-dot">{i + 1}</span>
                <span className="pipe-label">{s.label}</span>
              </div>
            ))}
          </div>

          {selected.approximate && (
            <div className="note">
              <WarningIcon size={16} />
              <span>
                This document type currently reuses a subset of the Statement-of-Claim skills as an
                approximation. Bespoke skills for it are on the roadmap.
              </span>
            </div>
          )}
        </>
      )}

      <label className="field" style={{ marginTop: 18 }}>
        <span className="lbl">
          Additional instructions <span className="hint">— optional</span>
        </span>
        <textarea
          value={instructions}
          placeholder="Anything specific for this draft — tone, emphasis, points to foreground or avoid…"
          onChange={(e) => setInstructions(e.target.value)}
        />
      </label>

      {error && (
        <div className="error-banner">
          <AlertIcon size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="btn-row">
        <button className="btn secondary" onClick={onBack}>
          <ArrowLeftIcon size={16} />
          Back
        </button>
        <button className="btn primary lg" onClick={onGenerate} disabled={!selected}>
          <SparkleIcon size={18} />
          Get draft
        </button>
      </div>
    </div>
  );
}
