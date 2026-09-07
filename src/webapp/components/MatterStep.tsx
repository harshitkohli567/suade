import { useRef, useState } from "react";
import {
  classifyDocuments,
  getMatterDocuments,
  uploadDocument,
  ClassificationResult,
  MatterRecord,
  UploadedDoc,
} from "../api";
import {
  AlertIcon,
  ArrowRightIcon,
  FileTextIcon,
  InfoIcon,
  SearchIcon,
  SpinnerIcon,
  UploadIcon,
} from "./Icons";

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

function Summary({ result }: { result: ClassificationResult }) {
  return (
    <>
      <div className="summary-line">{result.summary}</div>
      <div className="chips">
        {result.categories
          .filter((c) => c.count > 0)
          .map((c) => (
            <span key={c.id} className="chip">
              <b>{c.count.toLocaleString()}</b> {c.label}
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
      const result = await classifyDocuments(next.map((d) => ({ filename: d.filename, fileId: d.fileId })));
      setClassification(result);
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
      <h2>Matter and documents</h2>
      <p className="sub">
        Point Suade at an existing matter, or upload the case file and let it classify what&apos;s there.
      </p>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={matterSource === "id"}
          className={`tab ${matterSource === "id" ? "active" : ""}`}
          onClick={() => setMatterSource("id")}
        >
          Enter matter ID
        </button>
        <button
          role="tab"
          aria-selected={matterSource === "upload"}
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
              Matter ID <span className="hint">— for example DIS-SV-2024-0417</span>
            </span>
            <div className="inline-field">
              <input
                type="text"
                value={matterIdInput}
                placeholder="Enter your matter ID"
                onChange={(e) => setMatterIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && matterIdInput.trim() && lookupMatter()}
              />
              <button className="btn secondary" onClick={lookupMatter} disabled={busy || !matterIdInput.trim()}>
                {busy ? <SpinnerIcon size={16} /> : <SearchIcon size={16} />}
                {busy ? "Looking up" : "Look up"}
              </button>
            </div>
          </label>

          {matter && classification && (
            <>
              <div className="matter-facts">
                <b>{matter.client}</b> ({matter.representedSide}) v. {matter.counterparty}
                <br />
                {matter.matterType} · {matter.institutionSeat}
              </div>
              <Summary result={classification} />
              <div className="note">
                <InfoIcon size={16} />
                <span>
                  Documents pulled from the matter&apos;s linked storage via a connector preview. Live Google
                  Drive and Dropbox sync is coming next.
                </span>
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
              <span className="dz-busy">
                <SpinnerIcon size={18} /> Uploading and classifying…
              </span>
            ) : (
              <>
                <div className="dz-icon">
                  <UploadIcon size={26} />
                </div>
                <div>
                  <strong>Click to upload</strong> or drag and drop
                </div>
                <div className="dz-sub">PDF, DOCX, or Outlook .msg</div>
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
              <Summary result={classification} />
              {classification.classified && (
                <ul className="filelist">
                  {classification.classified.map((c, i) => (
                    <li key={i}>
                      <span className="fl-icon">
                        <FileTextIcon size={16} />
                      </span>
                      <span className="fl-name">{c.filename}</span>
                      <span className="cat">{c.category.replace(/-/g, " ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="error-banner">
          <AlertIcon size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="btn-row">
        <span />
        <button className="btn primary" onClick={onNext} disabled={!canContinue}>
          Continue
          <ArrowRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}
