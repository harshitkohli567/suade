import { useRef, useState } from "react";
import { generateCaseTheory, uploadDocument, CaseTheory, MatterRecord } from "../api";

interface Props {
  caseTheory: CaseTheory;
  setCaseTheory: (c: CaseTheory) => void;
  matter: MatterRecord | null;
  onBack: () => void;
  onNext: () => void;
}

export default function CaseTheoryStep({ caseTheory, setCaseTheory, matter, onBack, onNext }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFrom, setGeneratedFrom] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function update(field: keyof CaseTheory, value: string) {
    setCaseTheory({ ...caseTheory, [field]: value });
  }

  async function handleTranscript(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadDocument(file);
      const theory = await generateCaseTheory({ transcriptFileId: uploaded.fileId, matter });
      setCaseTheory(theory);
      setGeneratedFrom(file.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const hasContent = Boolean(caseTheory.facts || caseTheory.law || caseTheory.clientGoals);

  return (
    <div className="card">
      <h2>Case theory</h2>
      <p className="sub">
        Set out the theory of the case in three parts. Or upload a client-meeting transcript and Suade
        will draft them for you to refine.
      </p>

      <div className="dropzone" onClick={() => fileInput.current?.click()} style={{ marginBottom: 20 }}>
        {busy ? (
          "Reading transcript & drafting case theory…"
        ) : generatedFrom ? (
          <>
            Drafted from <strong>{generatedFrom}</strong> — edit below, or upload another transcript.
          </>
        ) : (
          <>
            <strong>Upload a client-meeting transcript</strong> to auto-draft the case theory
            <div style={{ fontSize: 12, marginTop: 6 }}>Optional · PDF, DOCX, .txt, or .msg</div>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt,.msg"
          style={{ display: "none" }}
          onChange={(e) => handleTranscript(e.target.files?.[0] || null)}
        />
      </div>

      <label className="field">
        <span className="lbl">Facts</span>
        <textarea
          value={caseTheory.facts}
          placeholder="The key facts and chronology as they support the client's position…"
          onChange={(e) => update("facts", e.target.value)}
        />
      </label>
      <label className="field">
        <span className="lbl">Law</span>
        <textarea
          value={caseTheory.law}
          placeholder="Legal basis — causes of action, governing law, key provisions relied on…"
          onChange={(e) => update("law", e.target.value)}
        />
      </label>
      <label className="field">
        <span className="lbl">Client goals</span>
        <textarea
          value={caseTheory.clientGoals}
          placeholder="What the client wants to achieve — remedies, commercial outcome, constraints…"
          onChange={(e) => update("clientGoals", e.target.value)}
        />
      </label>

      {error && <div className="error-banner">{error}</div>}

      <div className="btn-row">
        <button className="btn secondary" onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" onClick={onNext} disabled={!hasContent}>
          Continue →
        </button>
      </div>
    </div>
  );
}
