import { useEffect, useState } from "react";
import {
  getMe,
  logout,
  startDocumentGeneration,
  CaseTheory,
  ClassificationResult,
  MatterRecord,
  SessionUser,
  UploadedDoc,
} from "./api";
import Login from "./components/Login";
import Stepper from "./components/Stepper";
import MatterStep from "./components/MatterStep";
import CaseTheoryStep from "./components/CaseTheoryStep";
import DraftStep from "./components/DraftStep";
import GenerationView from "./components/GenerationView";
import { BriefcaseIcon, SpinnerIcon } from "./components/Icons";

/* global window */

type AuthState = "loading" | "in" | "out";

function initials(user: SessionUser | null): string {
  const src = user?.name || user?.email || "";
  const parts = src.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "U";
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const [step, setStep] = useState(1);
  const [matterSource, setMatterSource] = useState<"id" | "upload">("id");
  const [matter, setMatter] = useState<MatterRecord | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDoc[]>([]);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [caseTheory, setCaseTheory] = useState<CaseTheory>({ facts: "", law: "", clientGoals: "" });
  const [documentType, setDocumentType] = useState("");
  const [instructions, setInstructions] = useState("");

  const [generation, setGeneration] = useState<{ runId: string; docTypeLabel: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(({ user }) => {
        setUser(user);
        setAuth("in");
      })
      .catch(() => setAuth("out"));
  }, []);

  function onSignedIn(u: SessionUser) {
    setUser(u);
    setAuth("in");
    if (window.location.pathname !== "/app") {
      window.history.replaceState({}, "", "/app");
    }
  }

  async function onLogout() {
    await logout().catch(() => undefined);
    setUser(null);
    setAuth("out");
    window.history.replaceState({}, "", "/login");
  }

  async function onGenerate() {
    setGenError(null);
    try {
      const docsWithRoles = uploadedDocuments.map((d) => ({
        ...d,
        documentRole: d.category ? d.category.replace(/-/g, " ") : "case document",
      }));
      const res = await startDocumentGeneration({
        documentType,
        matter,
        caseTheory,
        uploadedDocuments: docsWithRoles,
        instructions,
      });
      setGeneration({ runId: res.runId, docTypeLabel: res.docType.label });
    } catch (e) {
      setGenError((e as Error).message);
    }
  }

  function startOver() {
    setGeneration(null);
    setStep(3);
  }

  if (auth === "loading") {
    return (
      <div className="center-spinner">
        <SpinnerIcon size={32} />
      </div>
    );
  }
  if (auth === "out") {
    return <Login onSignedIn={onSignedIn} />;
  }

  const matterLabel = matter ? `${matter.client} v. ${matter.counterparty.replace(/\s*\(.*\)\s*$/, "")}` : null;

  return (
    <>
      <header className="appbar">
        <div className="appbar-l">
          <span className="brand">
            Suade<span className="dot">.</span>
          </span>
          {matterLabel && (
            <span className="matter-chip" title={`${matterLabel} · ${matter!.matterId}`}>
              <BriefcaseIcon size={14} />
              <span className="txt">
                {matterLabel} · {matter!.matterId}
              </span>
            </span>
          )}
        </div>
        <div className="appbar-r">
          <span className="who">{user?.name || user?.email}</span>
          <span className="avatar" aria-hidden="true">
            {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : initials(user)}
          </span>
          <button className="link-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="workspace">
        {generation ? (
          <GenerationView
            runId={generation.runId}
            docTypeLabel={generation.docTypeLabel}
            documentCount={classification?.total}
            onStartOver={startOver}
          />
        ) : (
          <>
            <Stepper current={step} />
            {step === 1 && (
              <MatterStep
                matterSource={matterSource}
                setMatterSource={setMatterSource}
                matter={matter}
                setMatter={setMatter}
                uploadedDocuments={uploadedDocuments}
                setUploadedDocuments={setUploadedDocuments}
                classification={classification}
                setClassification={setClassification}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <CaseTheoryStep
                caseTheory={caseTheory}
                setCaseTheory={setCaseTheory}
                matter={matter}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <>
                <DraftStep
                  documentType={documentType}
                  setDocumentType={setDocumentType}
                  instructions={instructions}
                  setInstructions={setInstructions}
                  documentCount={classification?.total}
                  onBack={() => setStep(2)}
                  onGenerate={onGenerate}
                />
                {genError && <div className="error-banner">{genError}</div>}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
