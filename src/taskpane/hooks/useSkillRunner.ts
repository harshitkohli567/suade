import { useState } from "react";
import { MatterRecord, DocumentSection, SkillRecord, UploadedDocumentRecord } from "@/types";
import { readSectionText } from "../office/documentText";
import { BACKEND_URL } from "../config";

interface RunArgs {
  skill: SkillRecord | null;
  matter: MatterRecord | null;
  activeSection: DocumentSection | null;
  uploadedDocuments: UploadedDocumentRecord[];
  message: string;
}

export function useSkillRunner() {
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (args: RunArgs) => {
    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const sectionText = args.activeSection ? await readSectionText(args.activeSection) : "";

      const response = await fetch(`${BACKEND_URL}/api/run-skill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: args.skill ? args.skill.skillId : null,
          sourceFile: args.skill ? args.skill.sourceFile : null,
          matter: args.matter,
          section: args.activeSection
            ? { sectionId: args.activeSection.sectionId, title: args.activeSection.title, text: sectionText }
            : null,
          uploadedDocuments: args.uploadedDocuments.map((d) => ({
            filename: d.filename,
            documentRole: d.documentRole,
            fileId: d.claudeFileReference,
          })),
          message: args.message,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ||
            `Backend returned HTTP ${response.status}. Is "npm run server" running?`
        );
      }

      const data = (await response.json()) as { output: string };
      setOutput(data.output);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error running Skill. Check that the backend (npm run server) is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return { run, output, loading, error };
}
