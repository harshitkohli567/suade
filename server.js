require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const Anthropic = require("@anthropic-ai/sdk");
const { toFile } = require("@anthropic-ai/sdk");
const devCerts = require("office-addin-dev-certs");

/**
 * Suade backend (Step 7, extended Step 9). Holds the Anthropic API key
 * server-side (never in the task pane's client-side code) and mediates
 * two things: running a Skill, and uploading a document to Anthropic's
 * Files API so a Skill can actually read it.
 *
 * IMPORTANT correction to the original Decisions Log assumption: files
 * uploaded via client.beta.files.upload are scoped to the WORKSPACE of
 * this API key, not to an individual lawyer's personal account -- there
 * is no such mechanism. In practice this is arguably better for a firm
 * tool (every lawyer using this same backend/key can see the same
 * uploaded documents for a matter), but it means the earlier "one lawyer
 * per matter, account-scoped" assumption (FR-10.7) needs revisiting once
 * real multi-lawyer usage and auth exist -- not solved here, flagged.
 *
 * UNTESTED / uncertain: Anthropic's documentation for the "document"
 * content block via file_id is written around PDFs. DOCX support through
 * this exact path is not clearly documented. If DOCX uploads fail or
 * Claude can't read them, that's the most likely place -- tell me the
 * exact error and we'll add a conversion step rather than guess again.
 */

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set. Create a .env file in this directory with:\n" +
      "  ANTHROPIC_API_KEY=sk-ant-...\n" +
      "See README.md for details."
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SKILLS_DIR = path.join(__dirname, "src", "data", "skills", "source");
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 16000;
const FILES_API_BETA = "files-api-2025-04-14";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/upload-document", async (req, res) => {
  try {
    const { filename, mimeType, base64Content } = req.body;

    if (!filename || !mimeType || !base64Content) {
      return res.status(400).json({ error: "filename, mimeType, and base64Content are required." });
    }

    const buffer = Buffer.from(base64Content, "base64");
    const uploaded = await anthropic.beta.files.upload({
      file: await toFile(buffer, filename, { type: mimeType }),
      betas: [FILES_API_BETA],
    });

    res.json({
      fileId: uploaded.id,
      filename: uploaded.filename,
      mimeType: uploaded.mime_type,
      sizeBytes: uploaded.size_bytes,
    });
  } catch (err) {
    console.error("Suade backend upload error:", err);
    res.status(500).json({ error: err.message || "Unknown upload error." });
  }
});

app.post("/api/run-skill", async (req, res) => {
  try {
    const { skillId, sourceFile, matter, section, uploadedDocuments, message } = req.body;

    let skillInstructions = null;
    if (skillId || sourceFile) {
      if (!skillId || !sourceFile) {
        return res.status(400).json({ error: "skillId and sourceFile must both be provided if either is." });
      }

      const skillPath = path.join(SKILLS_DIR, sourceFile);
      if (!skillPath.startsWith(SKILLS_DIR)) {
        return res.status(400).json({ error: "Invalid sourceFile." });
      }
      if (!fs.existsSync(skillPath)) {
        return res.status(404).json({ error: `Skill file not found: ${sourceFile}` });
      }

      skillInstructions = fs.readFileSync(skillPath, "utf8");
    }

    const prompt = buildPrompt({ skillInstructions, matter, section, uploadedDocuments, message });

    const content = [{ type: "text", text: prompt }];
    const fileAttachments = (uploadedDocuments || []).filter((d) => d.fileId);
    for (const doc of fileAttachments) {
      content.push({ type: "document", source: { type: "file", file_id: doc.fileId } });
    }

    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: [FILES_API_BETA],
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content }],
    });

    console.log("Suade DEBUG: response block types:", response.content.map((b) => b.type), "| stop_reason:", response.stop_reason);    const textBlock = response.content.find((block) => block.type === "text");
    res.json({ output: textBlock ? textBlock.text : "" });
  } catch (err) {
    console.error("Suade backend error:", err);
    res.status(500).json({ error: err.message || "Unknown server error." });
  }
});

function buildPrompt({ skillInstructions, matter, section, uploadedDocuments, message }) {
  const parts = [];

  if (skillInstructions) {
    parts.push(`# Skill Instructions\n\n${skillInstructions}`);
  } else {
    parts.push(
      `# Skill Instructions\n\nNo Skill selected -- there is no specific drafting workflow to ` +
        `follow. Respond directly to the Lawyer's Message below, using the Matter Context, Current ` +
        `Document Section, and any Uploaded Documents provided.`
    );
  }

  if (matter) {
    parts.push(
      `# Matter Context\n\n` +
        `Client: ${matter.client}\n` +
        `Represented side: ${matter.representedSide}\n` +
        `Counterparty: ${matter.counterparty}\n` +
        `Matter type: ${matter.matterType}\n` +
        `Governing law: ${matter.governingLaw}\n` +
        `Institution/seat: ${matter.institutionSeat}`
    );
  } else {
    parts.push(`# Matter Context\n\nNo matter resolved -- proceed generically, flag anything that needs matter-specific facts.`);
  }

  if (section) {
    parts.push(
      `# Current Document Section\n\nSection ${section.sectionId} -- ${section.title}\n\n${
        section.text || "(no text captured for this section)"
      }`
    );
  } else {
    parts.push(`# Current Document Section\n\nNo section detected at the cursor.`);
  }

  if (uploadedDocuments && uploadedDocuments.length > 0) {
    const list = uploadedDocuments
      .map((d) =>
        d.fileId
          ? `- ${d.filename} (role: ${d.documentRole}) -- attached below as an actual document; its content IS available to you.`
          : `- ${d.filename} (role: ${d.documentRole}) -- NOTE: no file attached (legacy mock reference). Content is NOT available. Do not assume or invent its contents.`
      )
      .join("\n");
    parts.push(`# Uploaded Documents\n\n${list}`);
  } else {
    parts.push(`# Uploaded Documents\n\nNone uploaded for this matter.`);
  }

  if (message) {
    parts.push(`# Lawyer's Message\n\n${message}`);
  }

  parts.push(
    `# Task\n\nFollow the Skill Instructions above. Use the Matter Context, Current Document ` +
      `Section, and any attached Uploaded Documents actually provided. ${
        message ? "Also follow the Lawyer's Message above -- it takes priority where it conflicts with default Skill behaviour. " : ""
      }Where the ` +
      `Skill instructions call for a source document, fact table entry, or piece of evidence not ` +
      `actually supplied above (including any document listed as not attached), say so explicitly ` +
      `rather than inventing it. Produce the clean draft output the Skill instructions describe.`
  );

  return parts.join("\n\n---\n\n");
}

const PORT = process.env.SUADE_SERVER_PORT || 3001;

async function start() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Suade backend listening on https://localhost:${PORT}`);
  });
}

start();
