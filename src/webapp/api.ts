/**
 * Typed fetch helpers for the Suade web workspace.
 *
 * All calls are same-origin: in production this bundle is served by the
 * Suade server itself; in dev the webpack dev server proxies /api to the
 * backend (see webpack.config.js), so the session cookie stays first-party.
 */

export interface SessionUser {
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface MatterRecord {
  matterId: string;
  client: string;
  representedSide: string;
  counterparty: string;
  matterType: string;
  governingLaw: string;
  institutionSeat: string;
  responsibleLawyerTeam?: string;
}

export interface CategoryCount {
  id: string;
  label: string;
  count: number;
}

export interface ClassificationResult {
  total: number;
  categories: CategoryCount[];
  summary: string;
  source?: string;
  matter?: MatterRecord;
  classified?: { filename: string; fileId: string | null; category: string }[];
}

export interface UploadedDoc {
  fileId: string;
  filename: string;
  mimeType: string;
  documentUrl: string;
  documentRole?: string;
  category?: string;
}

export interface CaseTheory {
  facts: string;
  law: string;
  clientGoals: string;
}

export interface ReferenceInfo {
  name: string;
  label: string;
  kind: "protocol" | "knowledge" | "structure" | "reference";
}

export interface SkillRef {
  id: string;
  label: string;
  references?: ReferenceInfo[];
}

export interface DocTypeInfo {
  id: string;
  label: string;
  approximate: boolean;
  skills: SkillRef[];
  estimateSeconds: number;
  referenceCount?: number;
}

export interface GenStep {
  skillId: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  seconds?: string | null;
  error?: string | null;
}

export interface GenResult {
  docTypeLabel: string;
  draft: string;
  draftSections: { label: string; text: string }[];
  draftDocxBase64: string | null;
  draftFilename: string | null;
  workingNotesInline: string | null;
  workingNotesDocxBase64: string | null;
  workingNotesFilename: string | null;
}

export interface GenStatus {
  status: "running" | "done" | "error";
  docType: { id: string; label: string };
  estimateSeconds: number;
  steps: GenStep[];
  result: GenResult | null;
  error: string | null;
}

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// ---- Auth --------------------------------------------------------------
export function getAuthConfig(): Promise<{ googleClientId: string; configured: boolean }> {
  return jsonFetch("/api/auth/config");
}

export function getMe(): Promise<{ user: SessionUser }> {
  return jsonFetch("/api/auth/me");
}

export function signInWithGoogle(credential: string): Promise<{ user: SessionUser }> {
  return jsonFetch("/api/auth/google", { method: "POST", body: JSON.stringify({ credential }) });
}

export function logout(): Promise<{ ok: boolean }> {
  return jsonFetch("/api/auth/logout", { method: "POST" });
}

// ---- Documents ---------------------------------------------------------
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1)); // strip data URL prefix
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadDocument(file: File): Promise<UploadedDoc> {
  const base64Content = await fileToBase64(file);
  return jsonFetch<UploadedDoc>("/api/upload-document", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      base64Content,
    }),
  });
}

export function classifyDocuments(
  documents: { filename: string; fileId?: string; text?: string }[]
): Promise<ClassificationResult> {
  return jsonFetch("/api/webapp/classify-documents", {
    method: "POST",
    body: JSON.stringify({ documents }),
  });
}

export function getMatterDocuments(matterId: string): Promise<ClassificationResult> {
  return jsonFetch("/api/webapp/matter-documents", {
    method: "POST",
    body: JSON.stringify({ matterId }),
  });
}

export function generateCaseTheory(payload: {
  transcriptText?: string;
  transcriptFileId?: string;
  matter?: MatterRecord | null;
}): Promise<CaseTheory> {
  return jsonFetch("/api/webapp/generate-case-theory", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- Generation --------------------------------------------------------
export function getDocTypes(): Promise<{ documentTypes: DocTypeInfo[] }> {
  return jsonFetch("/api/webapp/doc-types");
}

export function startDocumentGeneration(payload: {
  documentType: string;
  matter: MatterRecord | null;
  caseTheory: CaseTheory;
  uploadedDocuments: UploadedDoc[];
  instructions: string;
}): Promise<{
  runId: string;
  docType: { id: string; label: string; approximate: boolean };
  steps: SkillRef[];
  estimateSeconds: number;
}> {
  return jsonFetch("/api/webapp/generate-document", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function pollDocumentGeneration(runId: string): Promise<GenStatus> {
  return jsonFetch(`/api/webapp/generate-document/${runId}`);
}
