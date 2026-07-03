import React, { useState } from "react";
import { MatterRecord, DocumentRole, UploadedDocumentRecord } from "@/types";
import { DOCUMENT_ROLES } from "./hooks/useDocumentUploads";

interface UploadSectionProps {
  matter: MatterRecord | null;
  uploadDocument: (file: File, matterId: string, documentRole: DocumentRole) => Promise<void>;
  removeDocument: (documentId: string) => void;
  documentsForMatter: (matterId: string) => UploadedDocumentRecord[];
  uploading: boolean;
  uploadError: string | null;
}

const UploadSection: React.FC<UploadSectionProps> = ({
  matter,
  uploadDocument,
  removeDocument,
  documentsForMatter,
  uploading,
  uploadError,
}) => {
  const [selectedRole, setSelectedRole] = useState<DocumentRole>("governing_contract");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!matter || !e.target.files || e.target.files.length === 0) {
      return;
    }
    const file = e.target.files[0];
    e.target.value = "";
    await uploadDocument(file, matter.matterId, selectedRole);
  };

  const docs = matter ? documentsForMatter(matter.matterId) : [];

  return (
    <div>
      <p style={styles.fieldLabel}>Uploaded Documents</p>
      <p style={styles.helperText}>
        Uploads go to Anthropic's Files API via the local backend (Step 9) -- real file content is
        available to Skills now, not a mock. DOCX support through this path is less certain than
        PDF; if a Skill can't read a DOCX upload, that's the likely cause.
      </p>

      {!matter && (
        <p style={styles.helperText}>
          <em>Detect a matter above first -- uploads are scoped to a resolved matter.</em>
        </p>
      )}

      {matter && (
        <>
          <div style={styles.uploadRow}>
            <select
              style={styles.select}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as DocumentRole)}
              disabled={uploading}
            >
              {DOCUMENT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              style={styles.fileInput}
              disabled={uploading}
            />
          </div>

          {uploading && <p style={styles.helperText}>Uploading…</p>}

          {uploadError && (
            <div style={styles.errorBox}>
              <strong>Upload error:</strong> {uploadError}
            </div>
          )}

          {docs.length === 0 && !uploading && (
            <p style={styles.helperText}>No documents uploaded for this matter yet.</p>
          )}

          {docs.length > 0 && (
            <ul style={styles.docList}>
              {docs.map((doc) => (
                <li key={doc.documentId}>
                  <strong>{doc.filename}</strong> [{doc.documentRole}] --{" "}
                  <span style={styles.fileIdTag}>{doc.claudeFileReference}</span>{" "}
                  <button style={styles.removeButton} onClick={() => removeDocument(doc.documentId)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  fieldLabel: { fontWeight: 700, color: "#5B6470", marginTop: "12px", fontSize: "13px" },
  helperText: { fontSize: "11px", color: "#5B6470", margin: "4px 0 8px 0", lineHeight: 1.5 },
  uploadRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" },
  select: { fontSize: "12px", padding: "4px" },
  fileInput: { fontSize: "12px" },
  docList: { margin: 0, paddingLeft: "18px", lineHeight: 1.8, fontSize: "11px" },
  fileIdTag: { color: "#2C5530" },
  errorBox: {
    fontSize: "12px",
    background: "#FBEAEA",
    border: "1px solid #D98C8C",
    borderRadius: "4px",
    padding: "8px",
    marginBottom: "8px",
  },
  removeButton: {
    fontSize: "10px",
    padding: "2px 6px",
    marginLeft: "4px",
    cursor: "pointer",
    border: "1px solid #DDE3EA",
    borderRadius: "3px",
    background: "#fff",
  },
};

export default UploadSection;
