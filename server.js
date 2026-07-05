require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");
const Anthropic = require("@anthropic-ai/sdk");
const { toFile } = require("@anthropic-ai/sdk");
const devCerts = require("office-addin-dev-certs");
const mammoth = require("mammoth");

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
 * DOCX handling: confirmed (not guessed) that Anthropic's Files API
 * document block rejects DOCX outright -- "Only PDF and plaintext
 * documents are supported" (tested directly against the API). So a DOCX
 * upload here gets its text extracted via mammoth and THAT plaintext is
 * what actually gets uploaded/attached, not the original .docx bytes.
 * This loses layout/formatting (tables collapse to concatenated cell
 * text, no styling) but preserves the actual textual content, which is
 * what Skills need. If a lawyer reports a Skill missing something that
 * was clearly in a table or text box in the original DOCX, that's the
 * likely cause -- not a bug in the Skill itself.
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
const FEEDBACK_LOG_PATH = path.join(__dirname, "skill-feedback.log");
const PLACEHOLDER_LAWYER_ID = "current lawyer (placeholder -- no auth built yet)";
const RUN_TTL_MS = 30 * 60 * 1000; // stale runs get swept so this doesn't grow unbounded

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

if (IS_PRODUCTION) {
  // In production this same server also serves the built task pane
  // (npm run build's dist/ output) so the whole add-in is one deployable
  // service on one domain -- no separate static host, no CORS to reason
  // about. In dev, the webpack dev server (:3000) serves the task pane
  // instead and this only runs the API on :3001.
  app.use(express.static(path.join(__dirname, "dist")));
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Skill runs can take well over a minute (extended thinking on longer
 * Skills), and Word's task pane webview aborts a single request that runs
 * past ~60s. So /api/run-skill kicks the Claude call off in the
 * background and returns a runId immediately; the task pane polls
 * /api/run-skill/:runId every few seconds for the result instead of
 * holding one long-lived connection open.
 */
const skillRuns = new Map(); // runId -> { status: "pending" | "done" | "error", output?, error?, createdAt }

setInterval(() => {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [runId, run] of skillRuns) {
    if (run.createdAt < cutoff) skillRuns.delete(runId);
  }
}, 5 * 60 * 1000);

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

app.post("/api/upload-document", async (req, res) => {
  try {
    const { filename, mimeType, base64Content } = req.body;

    if (!filename || !mimeType || !base64Content) {
      return res.status(400).json({ error: "filename, mimeType, and base64Content are required." });
    }

    const buffer = Buffer.from(base64Content, "base64");

    let uploadBuffer = buffer;
    let uploadFilename = filename;
    let uploadMimeType = mimeType;

    if (mimeType === DOCX_MIME_TYPE || filename.toLowerCase().endsWith(".docx")) {
      let extractedText;
      try {
        ({ value: extractedText } = await mammoth.extractRawText({ buffer }));
      } catch (extractErr) {
        console.error("Suade backend DOCX extraction error:", extractErr);
        return res.status(422).json({
          error: `Couldn't read ${filename} as a DOCX file -- it may be corrupted or not a real .docx.`,
        });
      }
      if (!extractedText.trim()) {
        return res.status(422).json({
          error: `Could not extract any text from ${filename} -- it may be empty, image-only, or corrupted.`,
        });
      }
      uploadBuffer = Buffer.from(extractedText, "utf8");
      uploadFilename = `${filename}.txt`;
      uploadMimeType = "text/plain";
    }

    const uploaded = await anthropic.beta.files.upload({
      file: await toFile(uploadBuffer, uploadFilename, { type: uploadMimeType }),
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

app.post("/api/run-skill", (req, res) => {
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

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    skillRuns.set(runId, { status: "pending", createdAt: Date.now() });
    res.json({ runId });

    // Fire-and-forget: the response above already went out, so a slow
    // Claude call here can't be aborted by Word's request timeout.
    executeSkillRun(runId, { skillInstructions, matter, section, uploadedDocuments, message });
  } catch (err) {
    console.error("Suade backend error:", err);
    res.status(500).json({ error: err.message || "Unknown server error." });
  }
});

app.get("/api/run-skill/:runId", (req, res) => {
  const run = skillRuns.get(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: "Unknown or expired runId." });
  }
  res.json(run);
});

async function executeSkillRun(runId, { skillInstructions, matter, section, uploadedDocuments, message }) {
  try {
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

    console.log("Suade DEBUG: response block types:", response.content.map((b) => b.type), "| stop_reason:", response.stop_reason);
    const textBlock = response.content.find((block) => block.type === "text");
    skillRuns.set(runId, { status: "done", output: textBlock ? textBlock.text : "", createdAt: Date.now() });
  } catch (err) {
    console.error("Suade backend error:", err);
    skillRuns.set(runId, { status: "error", error: err.message || "Unknown server error.", createdAt: Date.now() });
  }
}

app.post("/api/skill-feedback", (req, res) => {
  try {
    const { vote, skillId, skillName, matterId, sectionId, documentIds } = req.body;

    if (vote !== "up" && vote !== "down") {
      return res.status(400).json({ error: 'vote must be "up" or "down".' });
    }
    if (!skillId) {
      return res.status(400).json({ error: "skillId is required." });
    }

    const entry = {
      feedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vote,
      skillId,
      skillName: skillName || null,
      matterId: matterId || null,
      sectionId: sectionId || null,
      documentIds: Array.isArray(documentIds) ? documentIds : [],
      lawyerId: PLACEHOLDER_LAWYER_ID,
      createdAt: new Date().toISOString(),
    };

    fs.appendFileSync(FEEDBACK_LOG_PATH, `${JSON.stringify(entry)}\n`);
    res.json({ ok: true });
  } catch (err) {
    console.error("Suade backend feedback error:", err);
    res.status(500).json({ error: err.message || "Unknown error logging feedback." });
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

async function start() {
  if (IS_PRODUCTION) {
    // Render (and most Node PaaS hosts) terminate HTTPS at their proxy and
    // forward plain HTTP to the port they assign via $PORT -- no cert
    // handling needed here.
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`Suade backend (production) listening on port ${port}`);
    });
    return;
  }

  const PORT = process.env.SUADE_SERVER_PORT || 3001;
  const httpsOptions = await devCerts.getHttpsServerOptions();
  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Suade backend listening on https://localhost:${PORT}`);
  });
}

start();
