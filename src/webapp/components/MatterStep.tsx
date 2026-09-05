import { useRef, useState } from "react";
import {
  classifyDocuments,
  getMatterDocuments,
  uploadDocument,
  ClassificationResult,
  MatterRecord,
  UploadedDoc,
} from "../api";

interface Props {
  matterSource: "id" | "upload";
  setMatterSource: (s: "id" | "upload") => void;
  matter: MatterRecord | null;
  setMatter: (m: MatterRecord | null) => void;
  uploadedDocuments: UploadedDoc[];
  setUploadedDocuments: (d: UploadedDoc[]) => void;
  classification: ClassificationResult | null;
  setClassification: (c: ClassificationResult | null) => void;
  onNext: () => void;
}

function Chips({ result }: { result: ClassificationResult }) {
  return (
    <>
      <div className="summary-line">{result.summary}</div>
      <div className="chips">
        {result.categories
          .filter((c) => c.count > 0)
          .map((c) => (
            <span key={c.id} className="chip">
              <b>{c.count}</b> {c.label}
            </span>
          ))}
      </div>
    </>
  );
}

export default function MatterStep(props: Props) {
  const {
    matterSource,
    setMatterSource,
    matter,
    setMatter,
    uploadedDocuments,
    setUploadedDocuments,
    classification,
    setClassification,
    onNext,
  } = props;

  const [matterIdInput, setMatterIdInput] = useState(matter?.matterId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function lookupMatter() {
    setError(null);
    setBusy(true);
    try {
      const result = await getMatterDocuments(matterIdInput.trim());
      setClassification(result);
      setMatter(result.matter || null);
    } catch (e) {
      setError((e as Error).message);
      setClassification(null);
      setMatter(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const uploaded: UploadedDoc[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadDocument(file));
      }
      const next = [...uploadedDocuments, ...uploaded];
      setUploadedDocuments(next);
      // Classify the full set so counts reflect everything uploaded so far.
      const result = await classifyDocuments(next.map((d) => ({ filename: d.filename, fileId: d.fileId })));
      setClassification(result);
      // Tag each uploaded doc with its category (for later document roles).
      if (result.classified) {
        const byFile = new Map(result.classified.map((c) => [c.fileId, c.category]));
        setUploadedDocuments(next.map((d) => ({ ...d, category: byFile.get(d.fileId) || d.category })));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canContinue = matterSource === "id" ? Boolean(matter) : uploadedDocuments.length > 0;

  return (
    <div className="card">
      <h2>Matter &amp; documents</h2>
      <p className="sub">
        Point Suade at an existing matter, or upload the case file and let it classify what&apos;s there.
      </p>

      <div className="tabs">
        <button
          className={`tab ${matterSource === "id" ? "active" : ""}`}
          onClick={() => setMatterSource("id")}
        >
          Enter Matter ID
        </button>
        <button
          className={`tab ${matterSource === "upload" ? "active" : ""}`}
          onClick={() => setMatterSource("upload")}
        >
          Upload documents
        </button>
      </div>

      {matterSource === "id" ? (
        <>
          <label className="field">
            <span className="lbl">
              Matter ID <span className="hint">— e.g. DIS-SV-2024-0417</span>
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                value={matterIdInput}
                placeholder="Enter your matter ID"
                onChange={(e) => setMatterIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && matterIdInput.trim() && lookupMatter()}
              />
              <button
                className="btn secondary"
                onClick={lookupMatter}
                disabled={busy || !matterIdInput.trim()}
              >
                {busy ? "Looking up…" : "Look up"}
              </button>
            </div>
          </label>

          {matter && classification && (
            <>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 6 }}>
                <b>{matter.client}</b> ({matter.representedSide}) v. {matter.counterparty}
                <br />
                {matter.matterType} · {matter.institutionSeat}
              </div>
              <Chips result={classification} />
              <div className="note">
                Documents pulled from the matter&apos;s linked storage via a connector preview. Live
                Google Drive / Dropbox sync is coming next.
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div
            className={`dropzone ${dragging ? "drag" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            {busy ? (
              "Uploading & classifying…"
            ) : (
              <>
                <strong>Click to upload</strong> or drag &amp; drop
                <div style={{ fontSize: 12, marginTop: 6 }}>PDF, DOCX, or Outlook .msg</div>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.docx,.msg"
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {classification && (
            <div style={{ marginTop: 16 }}>
              <Chips result={classification} />
              {classification.classified && (
                <ul className="filelist">
                  {classification.classified.map((c, i) => (
                    <li key={i}>
                      <span>{c.filename}</span>
                      <span className="cat">{c.category.replace(/-/g, " ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="btn-row">
        <span />
        <button className="btn primary" onClick={onNext} disabled={!canContinue}>
          Continue →
        </button>
      </div>
    </div>
  );
}
