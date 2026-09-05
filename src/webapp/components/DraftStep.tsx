import { useEffect, useState } from "react";
import { getDocTypes, DocTypeInfo } from "../api";
import SkillGraph from "./SkillGraph";

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
      <p className="sub">Choose the document to draft. Suade runs the matching Skills in sequence.</p>

      <label className="field">
        <span className="lbl">Document type</span>
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
      </label>

      {selected && (
        <>
          <div className="estimate">
            <span>🕐</span>
            <span>
              {selected.skills.length} Skills will run in sequence · estimated {formatEstimate(selected.estimateSeconds)}
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
              This document type currently reuses a subset of the Statement-of-Claim Skills as an
              approximation. Bespoke Skills for it are on the roadmap.
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

      {error && <div className="error-banner">{error}</div>}

      <div className="btn-row">
        <button className="btn secondary" onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" onClick={onGenerate} disabled={!selected}>
          Get Draft
        </button>
      </div>
    </div>
  );
}
