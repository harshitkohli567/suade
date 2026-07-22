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
const MsgReader = require("@kenjiuno/msgreader").default;
const { buildWorkingNotesDocx } = require("./workingNotesDocx");
const skillEval = require("./skillEval");
const {
  sanitizeLawyerId,
  isProtectedSection,
  applyEditToMarkdown,
  buildInsertionDiff,
} = require("./skillCoachUtils");
const {
  loadRepositoryMatters,
  readExtraMatters,
  appendExtraMatter,
  findRepoMatchByParties,
  nextIntakeMatterId,
} = require("./serverMatters");
const { pdfViewerHtml, textViewerHtml, noPreviewHtml } = require("./documentViewer");

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

// Minimal Skill-run log (Activity Graph FR-2.1): which Skill produced which
// output, for which matter, when. JSONL, appended on each completed run.
const SKILL_RUNS_LOG_PATH = path.join(__dirname, "skill-runs.log");

// Step-completion eval corpus: one record per evaluated run (the per-step
// statuses + overall verdict). Seeds the eval dataset for skill quality.
const SKILL_EVAL_LOG_PATH = path.join(__dirname, "skill-evals.log");

/**
 * Edit-pair corpus: (model draft -> what the lawyer actually inserted),
 * captured at Insert time. This is the raw material for future style
 * learning (few-shot retrieval over past edits, and any eventual
 * fine-tuning decision) -- it only accumulates forward, so it's captured
 * from day one even though nothing consumes it yet. On Render, point
 * SUADE_EDIT_PAIRS_PATH at the persistent disk (e.g.
 * /var/data/edit-pairs.log) or the corpus is wiped on each redeploy.
 */
const EDIT_PAIRS_LOG_PATH = process.env.SUADE_EDIT_PAIRS_PATH || path.join(__dirname, "edit-pairs.log");

// Per-lawyer personal Skill copies + their version history (Skill Coach).
const PERSONAL_SKILLS_DIR = path.join(__dirname, "skills", "personal");
const SKILL_ID_RE = /^[a-z0-9-]+$/;

const COACH_CATEGORIES = ["new_step", "new_checklist_item", "domain_insight", "best_practice", "none"];

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Behind Render's proxy, req.protocol needs the forwarded header to
// report https -- citation URLs must be absolute and correct.
app.set("trust proxy", true);

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
const skillRuns = new Map(); // runId -> { status: "pending" | "done" | "error", output?, error?, createdAt, trace }
const evalRuns = new Map(); // evalRunId -> { status: "pending" | "done" | "error", record?, error?, createdAt }

/**
 * Execution trace shown live in the task pane's "Backend activity" panel.
 * Each entry corresponds to real code actually reaching that point -- do
 * not add aspirational/decorative entries the backend can't vouch for.
 */
function addTrace(runId, message) {
  const run = skillRuns.get(runId);
  if (!run) return;
  run.trace.push({ at: new Date().toISOString(), message });
}

setInterval(() => {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [runId, run] of skillRuns) {
    if (run.createdAt < cutoff) skillRuns.delete(runId);
  }
}, 5 * 60 * 1000);

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MSG_MIME_TYPE = "application/vnd.ms-outlook";

/**
 * Hosted copies of uploaded documents, so citations in Skill output can
 * hyperlink to the actual source file. The ORIGINAL bytes are kept (the
 * PDF/DOCX/MSG the lawyer uploaded), not the text extraction Claude
 * reads. URLs use an unguessable token (private-link model -- anyone
 * with the exact link can open it; there is no login).
 *
 * On Render, set SUADE_UPLOADS_DIR to a path on a persistent disk
 * (e.g. /var/data/uploads) -- without one, hosted files (and therefore
 * citation links embedded in documents) die on every redeploy.
 */
const UPLOADS_DIR = process.env.SUADE_UPLOADS_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const DOC_TOKEN_RE = /^doc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function storeHostedDocument(buffer, filename, mimeType, textExtract) {
  const token = `doc-${require("crypto").randomUUID()}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, token), buffer);
  fs.writeFileSync(
    path.join(UPLOADS_DIR, `${token}.json`),
    JSON.stringify({ filename, mimeType, uploadedAt: new Date().toISOString() })
  );
  if (textExtract) {
    // Powers the highlight viewer for formats browsers can't render
    // (DOCX/MSG); PDFs are searched client-side by PDF.js instead.
    fs.writeFileSync(path.join(UPLOADS_DIR, `${token}.txt`), textExtract);
  }
  return token;
}

function documentUrlFor(req, token) {
  return `${req.protocol}://${req.get("host")}/api/documents/${token}`;
}

/**
 * Outlook .msg -> plaintext. Same reasoning as the DOCX path: Anthropic's
 * document blocks only accept PDF and plaintext, so the email's fields and
 * body are extracted into a text rendering. Attachments inside the email
 * are listed by name but NOT extracted -- flagged in the output so Claude
 * never assumes it saw them.
 */
function msgToPlaintext(buffer) {
  const data = new MsgReader(buffer).getFileData();
  if (!data || data.error) {
    throw new Error(data && data.error ? data.error : "Could not parse .msg file.");
  }

  const bodyText =
    data.body ||
    (data.bodyHtml ? String(data.bodyHtml).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

  const recipients = (data.recipients || [])
    .map((r) => {
      const name = r.name || "";
      const email = r.smtpAddress || r.email || "";
      return name && email ? `${name} <${email}>` : name || email;
    })
    .filter(Boolean);

  const lines = [];
  const sender = [data.senderName, data.senderEmail ? `<${data.senderEmail}>` : ""].filter(Boolean).join(" ");
  lines.push(`From: ${sender || "(unknown sender)"}`);
  if (recipients.length > 0) lines.push(`To: ${recipients.join("; ")}`);
  if (data.messageDeliveryTime) lines.push(`Date: ${data.messageDeliveryTime}`);
  lines.push(`Subject: ${data.subject || "(no subject)"}`);
  lines.push("");
  lines.push(bodyText || "(no message body found)");

  const attachmentNames = (data.attachments || []).map((a) => a.fileName).filter(Boolean);
  if (attachmentNames.length > 0) {
    lines.push("");
    lines.push(
      `[This email had ${attachmentNames.length} attachment(s): ${attachmentNames.join(", ")} -- ` +
        `attachment contents are NOT included here.]`
    );
  }

  return lines.join("\n");
}

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
    } else if (mimeType === MSG_MIME_TYPE || filename.toLowerCase().endsWith(".msg")) {
      let emailText;
      try {
        emailText = msgToPlaintext(buffer);
      } catch (extractErr) {
        console.error("Suade backend MSG extraction error:", extractErr);
        return res.status(422).json({
          error: `Couldn't read ${filename} as an Outlook .msg file -- it may be corrupted or not a real .msg.`,
        });
      }
      uploadBuffer = Buffer.from(emailText, "utf8");
      uploadFilename = `${filename}.txt`;
      uploadMimeType = "text/plain";
    }

    const uploaded = await anthropic.beta.files.upload({
      file: await toFile(uploadBuffer, uploadFilename, { type: uploadMimeType }),
      betas: [FILES_API_BETA],
    });

    // Host the ORIGINAL file (not the extraction) for citation links; keep
    // the text extraction beside it for the highlight viewer. For plain
    // text the original is its own extraction.
    const textExtract = uploadMimeType === "text/plain" ? uploadBuffer.toString("utf8") : null;
    const documentToken = storeHostedDocument(buffer, filename, mimeType, textExtract);

    res.json({
      fileId: uploaded.id,
      filename: uploaded.filename,
      mimeType: uploaded.mime_type,
      sizeBytes: uploaded.size_bytes,
      documentToken,
      documentUrl: documentUrlFor(req, documentToken),
    });
  } catch (err) {
    console.error("Suade backend upload error:", err);
    res.status(500).json({ error: err.message || "Unknown upload error." });
  }
});

// PDF.js assets for the citation viewer, served from node_modules (no CDN).
app.use("/vendor/pdfjs", express.static(path.join(__dirname, "node_modules", "pdfjs-dist", "build")));

/**
 * Citation-highlight viewer. The supporting quote arrives in the URL
 * fragment (#q=...), which browsers never send to the server -- matching
 * and highlighting run entirely client-side.
 */
app.get("/api/documents/:token/view", (req, res) => {
  const { token } = req.params;
  if (!DOC_TOKEN_RE.test(token)) {
    return res.status(400).json({ error: "Invalid document token." });
  }

  const metaPath = path.join(UPLOADS_DIR, `${token}.json`);
  if (!fs.existsSync(metaPath) || !fs.existsSync(path.join(UPLOADS_DIR, token))) {
    return res.status(404).send("Document not found -- it may have been removed.");
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const filename = meta.filename || token;
  const isPdf = meta.mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  const textPath = path.join(UPLOADS_DIR, `${token}.txt`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (isPdf) {
    return res.send(pdfViewerHtml({ token, filename }));
  }
  if (fs.existsSync(textPath)) {
    return res.send(textViewerHtml({ token, filename, text: fs.readFileSync(textPath, "utf8") }));
  }
  res.send(noPreviewHtml({ token, filename }));
});

app.get("/api/documents/:token", (req, res) => {
  const { token } = req.params;
  if (!DOC_TOKEN_RE.test(token)) {
    return res.status(400).json({ error: "Invalid document token." });
  }

  const filePath = path.join(UPLOADS_DIR, token);
  const metaPath = path.join(UPLOADS_DIR, `${token}.json`);
  if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
    return res.status(404).json({ error: "Document not found -- it may have been removed." });
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  res.setHeader("Content-Type", meta.mimeType || "application/octet-stream");
  // inline lets browsers render PDFs directly; non-renderable types download.
  res.setHeader("Content-Disposition", `inline; filename="${(meta.filename || token).replace(/"/g, "")}"`);
  res.sendFile(filePath);
});

app.delete("/api/upload-document/:fileId", async (req, res) => {
  try {
    await anthropic.beta.files.delete(req.params.fileId, { betas: [FILES_API_BETA] });

    // Also remove the hosted copy so its citation link stops resolving.
    const docToken = req.query.docToken;
    if (typeof docToken === "string" && DOC_TOKEN_RE.test(docToken)) {
      fs.rmSync(path.join(UPLOADS_DIR, docToken), { force: true });
      fs.rmSync(path.join(UPLOADS_DIR, `${docToken}.json`), { force: true });
      fs.rmSync(path.join(UPLOADS_DIR, `${docToken}.txt`), { force: true });
    }

    res.json({ ok: true });
  } catch (err) {
    // Anthropic 404s if the file is already gone -- treat that as success
    // rather than an error, since the end state the caller wants (the
    // file not existing) is already true.
    if (err && err.status === 404) {
      return res.json({ ok: true });
    }
    console.error("Suade backend delete error:", err);
    res.status(500).json({ error: err.message || "Unknown error deleting file." });
  }
});

// ---------------------------------------------------------------------------
// Skill store helpers (firm defaults + per-lawyer personal copies)
// ---------------------------------------------------------------------------

/**
 * Skills now live one folder per skill (e.g. source/Breach/breach.md),
 * optionally with a references/ subfolder of supporting files -- the
 * Agent Skills layout. Resolution is by filename ({skillId}.md) anywhere
 * under SKILLS_DIR, so the folder names themselves don't matter and the
 * old flat layout keeps working too.
 */
function resolveFirmSkillFile(skillId) {
  const direct = path.join(SKILLS_DIR, `${skillId}.md`);
  if (fs.existsSync(direct)) return { filePath: direct, dir: SKILLS_DIR };

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (entry.isFile() && entry.name === `${skillId}.md`) {
        return { filePath: full, dir };
      }
    }
    return null;
  };
  return walk(SKILLS_DIR);
}

/** The skill folder's references/*.md files, if it has any. */
function loadSkillReferences(skillDir) {
  const refDir = path.join(skillDir, "references");
  if (!fs.existsSync(refDir)) return [];
  return fs
    .readdirSync(refDir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort()
    .map((f) => ({
      name: `references/${f}`,
      content: fs.readFileSync(path.join(refDir, f), "utf8"),
    }));
}

/**
 * Inlines a skill's reference files after its main instructions, so the
 * "consult references/x.md" pointers inside the skill actually resolve
 * to content Claude can see.
 */
function renderSkillWithReferences(content, references) {
  if (references.length === 0) return content;
  const blocks = references.map(
    (r) => `<skill_reference_file name="${r.name}">\n${r.content}\n</skill_reference_file>`
  );
  return (
    `${content}\n\n# Reference Files\n\nThe instructions above consult these reference files; ` +
    `their full contents follow.\n\n${blocks.join("\n\n")}`
  );
}

function personalPathFor(lawyerId, skillId) {
  return path.join(PERSONAL_SKILLS_DIR, sanitizeLawyerId(lawyerId), `${skillId}.md`);
}

function versionsPathFor(lawyerId, skillId) {
  return path.join(PERSONAL_SKILLS_DIR, sanitizeLawyerId(lawyerId), `${skillId}.versions.json`);
}

/**
 * Personal copy if one exists for this lawyer, else the firm default.
 * References always come from the firm skill folder -- the personal copy
 * only ever forks the main instructions file, so coached copies keep
 * following the firm's reference files.
 */
function loadSkillMarkdown(lawyerId, skillId) {
  const firm = resolveFirmSkillFile(skillId);
  const references = firm ? loadSkillReferences(firm.dir) : [];

  const personalPath = personalPathFor(lawyerId, skillId);
  if (fs.existsSync(personalPath)) {
    return { content: fs.readFileSync(personalPath, "utf8"), source: "personal", references };
  }
  if (!firm) {
    return null;
  }
  return { content: fs.readFileSync(firm.filePath, "utf8"), source: "firm-default", references };
}

function readVersions(lawyerId, skillId) {
  const p = versionsPathFor(lawyerId, skillId);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8")).versions;
}

function writeVersions(lawyerId, skillId, versions) {
  fs.writeFileSync(versionsPathFor(lawyerId, skillId), JSON.stringify({ versions }, null, 2));
}

function newVersionId() {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ensures the lawyer has a personal copy of the Skill, cloning the firm
 * default (with a baseline version record) on first touch.
 */
function ensurePersonalCopy(lawyerId, skillId) {
  const personalPath = personalPathFor(lawyerId, skillId);
  if (fs.existsSync(personalPath)) return;

  const firm = resolveFirmSkillFile(skillId);
  if (!firm) {
    throw new Error(`No firm-default skill file found for ${skillId}.`);
  }
  const content = fs.readFileSync(firm.filePath, "utf8");
  fs.mkdirSync(path.dirname(personalPath), { recursive: true });
  fs.writeFileSync(personalPath, content);
  writeVersions(lawyerId, skillId, [
    {
      versionId: newVersionId(),
      timestamp: new Date().toISOString(),
      matterId: null,
      sourceMessage: null,
      category: "baseline",
      diff: null,
      diffSummary: "Cloned from firm-default Skill",
      content,
    },
  ]);
}

app.post("/api/run-skill", (req, res) => {
  try {
    const { skillId, sourceFile, matter, section, uploadedDocuments, message, lawyerId } = req.body;

    let skillInstructions = null;
    let skillSource = null;
    if (skillId || sourceFile) {
      if (!skillId || !sourceFile) {
        return res.status(400).json({ error: "skillId and sourceFile must both be provided if either is." });
      }
      if (!SKILL_ID_RE.test(skillId)) {
        return res.status(400).json({ error: "Invalid skillId." });
      }

      // A lawyer's coached (personal) copy takes precedence over the firm
      // default -- that's what makes Skill Coach edits apply "going forward".
      const loaded = loadSkillMarkdown(lawyerId, skillId);
      if (!loaded) {
        return res.status(404).json({ error: `Skill file not found: ${sourceFile}` });
      }
      skillInstructions = renderSkillWithReferences(loaded.content, loaded.references);
      skillSource =
        loaded.references.length > 0
          ? `${loaded.source}, +${loaded.references.length} reference file${loaded.references.length === 1 ? "" : "s"}`
          : loaded.source;
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    skillRuns.set(runId, { status: "pending", createdAt: Date.now(), trace: [] });
    addTrace(runId, "Request received");
    addTrace(
      runId,
      skillInstructions
        ? `Loaded Skill: ${skillId}.md (${(skillInstructions.length / 1024).toFixed(1)} KB, ${skillSource})`
        : "No Skill selected -- message-only run"
    );
    res.json({ runId });

    // Fire-and-forget: the response above already went out, so a slow
    // Claude call here can't be aborted by Word's request timeout.
    executeSkillRun(runId, { skillId, skillInstructions, matter, section, uploadedDocuments, message });
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

// ---------------------------------------------------------------------------
// Skill-run eval (v1: Factual Background step-completion check). Runs as its
// own background job -- the judge reads potentially large working notes and
// must not hit Word's ~60s webview timeout -- so the client kicks it off,
// gets an evalRunId, and polls, exactly like a skill run.
// ---------------------------------------------------------------------------

setInterval(() => {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [id, run] of evalRuns) {
    if (run.createdAt < cutoff) evalRuns.delete(id);
  }
}, 60 * 1000).unref?.();

async function executeEval(evalRunId, { cleanDraft, workingNotesRaw, uploadedDocCount, matterId }) {
  try {
    const prompt = skillEval.buildEvalPrompt({
      cleanDraft,
      workingNotes: workingNotesRaw,
      uploadedDocCount,
      matterId,
    });
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    let steps = skillEval.parseEvalJson(textBlock ? textBlock.text : "");
    steps = skillEval.applyDeterministicGuards(steps, { workingNotes: workingNotesRaw, uploadedDocCount });
    const { overall, summary } = skillEval.computeOverall(steps);
    const record = { skillId: skillEval.FACTUAL_BACKGROUND_SKILL_ID, overall, summary, steps };

    const run = evalRuns.get(evalRunId);
    if (run) {
      run.status = "done";
      run.record = record;
      run.createdAt = Date.now();
    }
    console.log(`Suade skill-eval ${evalRunId}: ${overall} (${summary.complete}/${summary.total} complete)`);
    fs.appendFileSync(
      SKILL_EVAL_LOG_PATH,
      `${JSON.stringify({ evalRunId, matterId: matterId || null, evaluatedAt: new Date().toISOString(), ...record })}\n`
    );
  } catch (err) {
    console.error("Suade skill-eval error:", err);
    const run = evalRuns.get(evalRunId);
    if (run) {
      run.status = "error";
      run.error = friendlyApiError(err);
    }
  }
}

app.post("/api/skill-eval", (req, res) => {
  try {
    const { runId } = req.body;
    const run = skillRuns.get(runId);
    if (!run || run.status !== "done") {
      return res.status(404).json({ error: "Unknown, unfinished, or expired runId." });
    }
    if (run.skillId !== skillEval.FACTUAL_BACKGROUND_SKILL_ID) {
      return res.status(400).json({ error: "No eval defined for this skill yet.", skillId: run.skillId || null });
    }
    if (!run.workingNotesRaw) {
      return res.status(400).json({ error: "This run produced no working notes to evaluate." });
    }

    const evalRunId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    evalRuns.set(evalRunId, { status: "pending", createdAt: Date.now() });
    res.json({ evalRunId });

    executeEval(evalRunId, {
      cleanDraft: run.cleanDraft || run.output || "",
      workingNotesRaw: run.workingNotesRaw,
      uploadedDocCount: run.uploadedDocCount,
      matterId: run.matterId,
    });
  } catch (err) {
    console.error("Suade skill-eval start error:", err);
    res.status(500).json({ error: err.message || "Unknown error starting eval." });
  }
});

app.get("/api/skill-eval/:evalRunId", (req, res) => {
  const run = evalRuns.get(req.params.evalRunId);
  if (!run) {
    return res.status(404).json({ error: "Unknown or expired evalRunId." });
  }
  res.json(run);
});

/**
 * Splits a skill response into its two channels. Tag-less responses
 * (message-only runs, or a model that ignored the format) fall back to
 * everything-is-the-draft so nothing is ever lost.
 */
function splitChannels(text) {
  const draftMatch = text.match(/<clean_draft>([\s\S]*?)<\/clean_draft>/i);
  const notesMatch = text.match(/<working_notes>([\s\S]*?)<\/working_notes>/i);

  if (!draftMatch) {
    const withoutNotes = notesMatch ? text.replace(notesMatch[0], "") : text;
    return {
      cleanDraft: withoutNotes.trim(),
      workingNotes: notesMatch && notesMatch[1].trim() ? notesMatch[1].trim() : null,
    };
  }

  return {
    cleanDraft: draftMatch[1].trim(),
    workingNotes: notesMatch && notesMatch[1].trim() ? notesMatch[1].trim() : null,
  };
}

function prettifySkillName(skillId) {
  return String(skillId || "Skill")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Anthropic returns transient failures under load: 529 overloaded, 429
 * rate-limited, and occasional 5xx. A skill run is polled in the
 * background, so it can afford widely-spaced retries the lawyer never
 * sees beyond a trace entry. (The SDK's own quick retries still apply
 * within each attempt; this adds a slower second layer for sustained
 * overload.)
 */
const RETRYABLE_API_STATUSES = new Set([429, 500, 502, 503, 529]);
const API_RETRY_DELAYS_MS = [5000, 15000, 30000];

async function callClaudeWithRetry(runId, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await anthropic.beta.messages.create(params);
    } catch (err) {
      const retryable = err && RETRYABLE_API_STATUSES.has(err.status);
      if (!retryable || attempt >= API_RETRY_DELAYS_MS.length) throw err;
      const delayMs = API_RETRY_DELAYS_MS[attempt];
      addTrace(
        runId,
        `Claude API ${err.status === 529 ? "overloaded (529)" : `error ${err.status}`} -- retrying in ` +
          `${delayMs / 1000}s (attempt ${attempt + 2} of ${API_RETRY_DELAYS_MS.length + 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** Raw Anthropic errors read as JSON dumps -- translate the common transient ones for the pane. */
function friendlyApiError(err) {
  if (err && err.status === 529) {
    return "Claude's API is temporarily overloaded (Anthropic-side, transient). Wait a minute and run again.";
  }
  if (err && err.status === 429) {
    return "Claude's API rate limit was hit. Wait a minute and run again.";
  }
  return err && err.message ? err.message : "Unknown server error.";
}

async function executeSkillRun(runId, { skillId, skillInstructions, matter, section, uploadedDocuments, message }) {
  const startedAt = Date.now();
  try {
    const fileAttachments = (uploadedDocuments || []).filter((d) => d.fileId);
    addTrace(
      runId,
      fileAttachments.length > 0
        ? `Attached ${fileAttachments.length} document${fileAttachments.length === 1 ? "" : "s"}: ${fileAttachments
            .map((d) => d.filename)
            .join(", ")}`
        : "No documents attached"
    );

    const prompt = buildPrompt({ skillInstructions, matter, section, uploadedDocuments, message });
    addTrace(runId, `Prompt assembled: ${prompt.length.toLocaleString()} characters`);

    const content = [{ type: "text", text: prompt }];
    for (const doc of fileAttachments) {
      content.push({ type: "document", source: { type: "file", file_id: doc.fileId } });
    }

    addTrace(runId, `Claude API call started (model ${MODEL})`);
    const response = await callClaudeWithRetry(runId, {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: [FILES_API_BETA],
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content }],
    });

    console.log("Suade DEBUG: response block types:", response.content.map((b) => b.type), "| stop_reason:", response.stop_reason);
    const textBlock = response.content.find((block) => block.type === "text");
    const rawOutput = textBlock ? textBlock.text : "";
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    addTrace(runId, `Response complete: ${rawOutput.length.toLocaleString()} characters in ${seconds}s`);

    const { cleanDraft, workingNotes } = splitChannels(rawOutput);

    let workingNotesDocxBase64 = null;
    let workingNotesFilename = null;
    let workingNotesInline = null;
    if (workingNotes) {
      addTrace(
        runId,
        `Split output: clean draft ${cleanDraft.length.toLocaleString()} chars, working notes ${workingNotes.length.toLocaleString()} chars`
      );
      try {
        const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
        workingNotesFilename = `${skillId || "skill"}-working-notes-${stamp}.docx`;
        workingNotesDocxBase64 = await buildWorkingNotesDocx({
          skillDisplayName: prettifySkillName(skillId),
          matterId: matter ? matter.matterId : null,
          notesMarkdown: workingNotes,
        });
        addTrace(
          runId,
          `Working notes rendered to ${workingNotesFilename} (${Math.round(workingNotesDocxBase64.length / 1370)} KB)`
        );
      } catch (docxErr) {
        // Never lose the notes: fall back to inline display in the pane.
        console.error("Suade working-notes docx generation failed:", docxErr);
        addTrace(runId, "Working notes .docx generation failed -- notes shown inline instead");
        workingNotesFilename = null;
        workingNotesDocxBase64 = null;
        workingNotesInline = workingNotes;
      }
    }

    // Mutate rather than replace so the accumulated trace survives; bump
    // createdAt so the TTL sweep counts from completion, not run start.
    const run = skillRuns.get(runId);
    if (run) {
      run.status = "done";
      run.output = cleanDraft;
      run.workingNotesDocxBase64 = workingNotesDocxBase64;
      run.workingNotesFilename = workingNotesFilename;
      run.workingNotesInline = workingNotesInline;
      run.createdAt = Date.now();
      // Retained for the step-completion eval, which needs the RAW working
      // notes (the docx/base64 the client gets back is opaque to it).
      run.skillId = skillId || null;
      run.matterId = matter ? matter.matterId : null;
      run.cleanDraft = cleanDraft;
      run.workingNotesRaw = workingNotes || null;
      run.uploadedDocCount = Array.isArray(uploadedDocuments) ? uploadedDocuments.length : null;
    }

    // Minimal Activity Graph record (FR-2.1): which Skill produced which
    // output for which matter. Skill Coach's classify step builds on this.
    fs.appendFileSync(
      SKILL_RUNS_LOG_PATH,
      `${JSON.stringify({
        skillRunId: runId,
        skillId: skillId || null,
        matterId: matter ? matter.matterId : null,
        timestamp: new Date().toISOString(),
        output: cleanDraft,
        workingNotes,
      })}\n`
    );
  } catch (err) {
    console.error("Suade backend error:", err);
    const errorMessage = friendlyApiError(err);
    addTrace(runId, `Error: ${errorMessage}`);
    const run = skillRuns.get(runId);
    if (run) {
      run.status = "error";
      run.error = errorMessage;
      run.createdAt = Date.now();
    }
  }
}

const EDIT_PAIR_ID_RE = /^ep-[A-Za-z0-9-]{6,64}$/;

app.post("/api/edit-pairs", (req, res) => {
  try {
    const { editPairId, lawyerId, skillId, skillName, matterId, sectionId, insertTarget, modelDraft, finalText } =
      req.body;

    if (typeof modelDraft !== "string" || typeof finalText !== "string" || !finalText.trim()) {
      return res.status(400).json({ error: "modelDraft and finalText are required." });
    }

    const entry = {
      type: "insert",
      // Client-generated id: it doubles as the tag of the content control
      // wrapping the inserted text in the Word document, which is how
      // later post-insert edits get matched back to this pair.
      editPairId:
        typeof editPairId === "string" && EDIT_PAIR_ID_RE.test(editPairId)
          ? editPairId
          : `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lawyerId: lawyerId || null,
      skillId: skillId || null,
      skillName: skillName || null,
      matterId: matterId || null,
      sectionId: sectionId || null,
      insertTarget: insertTarget || null,
      modelDraft,
      finalText,
      // Unedited acceptances are logged too -- "the lawyer changed nothing"
      // is itself a strong positive signal about the draft.
      edited: modelDraft !== finalText,
      createdAt: new Date().toISOString(),
    };

    fs.appendFileSync(EDIT_PAIRS_LOG_PATH, `${JSON.stringify(entry)}\n`);
    res.json({ ok: true, editPairId: entry.editPairId });
  } catch (err) {
    console.error("Suade edit-pair log error:", err);
    res.status(500).json({ error: err.message || "Unknown error logging edit pair." });
  }
});

/**
 * Post-insert snapshots: the task pane periodically re-reads each
 * inserted draft's content control from the Word document and reports
 * the current text when it changed. Append-only; consumers take the
 * LAST final-update per editPairId (falling back to the insert-time
 * finalText when none exists).
 */
app.post("/api/edit-pairs/update", (req, res) => {
  try {
    const { editPairId, finalText } = req.body;

    if (typeof editPairId !== "string" || !EDIT_PAIR_ID_RE.test(editPairId)) {
      return res.status(400).json({ error: "A valid editPairId is required." });
    }
    if (typeof finalText !== "string" || !finalText.trim()) {
      return res.status(400).json({ error: "finalText is required." });
    }

    const entry = {
      type: "final-update",
      editPairId,
      finalText,
      capturedAt: new Date().toISOString(),
    };
    fs.appendFileSync(EDIT_PAIRS_LOG_PATH, `${JSON.stringify(entry)}\n`);
    res.json({ ok: true });
  } catch (err) {
    console.error("Suade edit-pair update error:", err);
    res.status(500).json({ error: err.message || "Unknown error logging edit-pair update." });
  }
});

/**
 * Labeled ground-truth signal: the predicted rationale for a post-insert
 * edit, plus the lawyer's yes/no confirmation. Append-only into the same
 * corpus as the edit pairs -- this is the first labeled dataset tying a
 * concrete edit to a confirmed reason. Capture only; nothing here mutates
 * the document or any Skill.
 */
app.post("/api/edit-pairs/rationale", (req, res) => {
  try {
    const {
      editPairId,
      sectionId,
      skillId,
      skillName,
      matterId,
      category,
      subIntent,
      predictedRationale,
      question,
      confidence,
      answer,
      diffSummary,
      predictedAt,
    } = req.body;

    if (typeof editPairId !== "string" || !EDIT_PAIR_ID_RE.test(editPairId)) {
      return res.status(400).json({ error: "A valid editPairId is required." });
    }
    if (answer !== "yes" && answer !== "no") {
      return res.status(400).json({ error: 'answer must be "yes" or "no".' });
    }

    const entry = {
      type: "rationale-signal",
      editPairId,
      sectionId: sectionId || null,
      skillId: skillId || null,
      skillName: skillName || null,
      matterId: matterId || null,
      category: category || null,
      subIntent: typeof subIntent === "string" ? subIntent : null,
      taxonomyVersion: TAXONOMY_VERSION,
      predictedRationale: typeof predictedRationale === "string" ? predictedRationale : null,
      question: typeof question === "string" ? question : null,
      confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
      answer,
      diffSummary: diffSummary && typeof diffSummary === "object" ? diffSummary : null,
      predictedAt: predictedAt || null,
      answeredAt: new Date().toISOString(),
    };
    fs.appendFileSync(EDIT_PAIRS_LOG_PATH, `${JSON.stringify(entry)}\n`);
    res.json({ ok: true });
  } catch (err) {
    console.error("Suade edit-pair rationale error:", err);
    res.status(500).json({ error: err.message || "Unknown error logging rationale signal." });
  }
});

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

// ---------------------------------------------------------------------------
// Matter intake: starting from a blank document, an initial instruction +
// client materials (transcript, email) establish the matter -- matched
// against the repository when the parties already exist there, otherwise
// extracted into a new matter persisted in matters-extra.json.
// ---------------------------------------------------------------------------

app.get("/api/matters-extra", (req, res) => {
  try {
    res.json({ matters: readExtraMatters() });
  } catch (err) {
    console.error("Suade matters-extra error:", err);
    res.status(500).json({ error: err.message || "Unknown error reading extra matters." });
  }
});

function buildIntakePrompt(instruction) {
  return [
    `You are the matter-intake assistant in Suade, a Word add-in for arbitration lawyers. A ` +
      `lawyer is starting a new document from a blank page. They have given the initial ` +
      `instruction below, and may have attached client materials (a meeting transcript, an email ` +
      `from the client) as documents.`,
    `Extract the matter details. The CLIENT is the party this lawyer represents -- infer the ` +
      `perspective from the instruction and materials (e.g. the client is usually the email's ` +
      `sender or the party whose team wrote the meeting notes).`,
    `<lawyer_instruction>\n${instruction || "(none given -- rely on the attached materials)"}\n</lawyer_instruction>`,
    `Rules:\n` +
      `- Use party names exactly as written in the materials.\n` +
      `- Do NOT invent details that are not stated -- return null for that field and explain what's missing in "gaps".\n` +
      `- representedSide is the client's role in the dispute: "Claimant", "Respondent", or "Other" if unclear.\n` +
      `- Keep matterType short, e.g. "Commercial arbitration -- breach of supply agreement".`,
    `Respond with ONLY a JSON object, no other text:\n` +
      `{"client": string|null, "representedSide": "Claimant"|"Respondent"|"Other"|null, ` +
      `"counterparty": string|null, "matterType": string|null, "governingLaw": string|null, ` +
      `"institutionSeat": string|null, "gaps": string[]}`,
  ].join("\n\n");
}

app.post("/api/matter-intake", async (req, res) => {
  try {
    const { instruction, uploadedDocuments } = req.body;
    const fileAttachments = (uploadedDocuments || []).filter((d) => d.fileId);

    if ((!instruction || !String(instruction).trim()) && fileAttachments.length === 0) {
      return res.status(400).json({ error: "Provide an instruction, an uploaded document, or both." });
    }

    const content = [{ type: "text", text: buildIntakePrompt(instruction) }];
    for (const doc of fileAttachments) {
      content.push({ type: "document", source: { type: "file", file_id: doc.fileId } });
    }

    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 1500,
      betas: [FILES_API_BETA],
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    let extracted;
    try {
      const raw = (textBlock ? textBlock.text : "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      extracted = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    } catch (parseErr) {
      console.error("Suade matter intake: unparseable extraction:", parseErr.message);
      return res.status(422).json({ error: "Could not extract matter details from the materials provided." });
    }

    if (!extracted.client && !extracted.counterparty) {
      return res.status(422).json({
        error: "Could not identify the parties from the instruction/materials -- add more detail and try again.",
        gaps: Array.isArray(extracted.gaps) ? extracted.gaps : [],
      });
    }

    // Prefer an existing matter when both parties unambiguously match one.
    const allKnown = [...loadRepositoryMatters(), ...readExtraMatters()];
    const repoMatch =
      extracted.client && extracted.counterparty
        ? findRepoMatchByParties(extracted.client, extracted.counterparty, allKnown)
        : null;

    if (repoMatch) {
      console.log(`Suade matter intake: matched existing matter ${repoMatch.matterId}`);
      return res.json({
        matter: repoMatch,
        source: "repository",
        note: `Matched existing matter ${repoMatch.matterId} from the parties named in your materials.`,
        gaps: [],
      });
    }

    const validSides = ["Claimant", "Respondent", "Other"];
    const matter = {
      matterId: nextIntakeMatterId(),
      client: extracted.client || "(not stated)",
      representedSide: validSides.includes(extracted.representedSide) ? extracted.representedSide : "Other",
      counterparty: extracted.counterparty || "(not stated)",
      matterType: extracted.matterType || "(not stated)",
      governingLaw: extracted.governingLaw || "(not stated)",
      institutionSeat: extracted.institutionSeat || "(not stated)",
      responsibleLawyerTeam: "Unassigned",
    };
    appendExtraMatter(matter);

    console.log(`Suade matter intake: created new matter ${matter.matterId} (${matter.client} v ${matter.counterparty})`);
    res.json({
      matter,
      source: "extracted",
      note: `New matter ${matter.matterId} created from your intake materials.`,
      gaps: Array.isArray(extracted.gaps) ? extracted.gaps : [],
    });
  } catch (err) {
    console.error("Suade matter intake error:", err);
    res.status(500).json({ error: friendlyApiError(err) });
  }
});

// ---------------------------------------------------------------------------
// Skill Coach: a lawyer's follow-up message after a Skill run can update
// that Skill going forward (classify -> commit -> undo).
// ---------------------------------------------------------------------------

function buildCoachClassifyPrompt({ displayName, skillMarkdown, references, priorOutput, lawyerMessage }) {
  const referenceBlock =
    references && references.length > 0
      ? `The skill also has reference files, included for context ONLY -- proposed edits must ` +
        `target a section of the main skill file above, never a reference file:\n\n` +
        references.map((r) => `<skill_reference_file name="${r.name}">\n${r.content}\n</skill_reference_file>`).join("\n\n")
      : null;
  return [
    `You are "Skill Coach" inside Suade, a Word add-in for arbitration lawyers. Skills are ` +
      `markdown playbooks that drive drafting. A lawyer just ran the "${displayName}" Skill, ` +
      `received the output below, and then sent the follow-up message below.`,
    `Classify the follow-up into EXACTLY one category:\n` +
      `- "new_step": adds a new procedural step the Skill's process should include every time\n` +
      `- "new_checklist_item": adds a concrete item the Skill should check or verify every time\n` +
      `- "domain_insight": a durable legal/domain fact or rule the Skill should always take into account\n` +
      `- "best_practice": a drafting/style/formatting practice the Skill should always follow\n` +
      `- "none": anything else`,
    `STRICT RULE: choose one of the first four ONLY if a reasonable Skill author would want this ` +
      `applied to EVERY future matter that uses this Skill -- not just the current matter's facts. ` +
      `Matter-specific facts or names, one-off questions, requests to clarify/shorten/redo THIS ` +
      `output, and comments about THIS matter are all "none". When in doubt or ambiguous, choose "none".`,
    `If (and only if) the category is not "none", also draft the edit:\n` +
      `- "targetSection": the heading text of the existing section in the Skill file where the ` +
      `addition belongs, quoted as it appears in the file (e.g. "4. Process" or "Phase 3 -- ...")\n` +
      `- "insertText": the exact markdown to insert -- concise, imperative, generalized beyond ` +
      `this matter (no party names unless the guidance is inherently about them)`,
    `<skill_file>\n${skillMarkdown}\n</skill_file>`,
    ...(referenceBlock ? [referenceBlock] : []),
    `<prior_skill_output>\n${String(priorOutput || "").slice(0, 6000)}\n</prior_skill_output>`,
    `<lawyer_follow_up_message>\n${lawyerMessage}\n</lawyer_follow_up_message>`,
    `Respond with ONLY a JSON object, no other text:\n` +
      `{"category": "...", "targetSection": string or null, "insertText": string or null}`,
  ].join("\n\n");
}

function parseCoachJson(text) {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON object in response");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!COACH_CATEGORIES.includes(parsed.category)) throw new Error(`bad category: ${parsed.category}`);
    return {
      category: parsed.category,
      targetSection: typeof parsed.targetSection === "string" ? parsed.targetSection : null,
      insertText: typeof parsed.insertText === "string" ? parsed.insertText : null,
    };
  } catch (err) {
    // Bias toward "none": a malformed classification must never mutate a Skill.
    console.error("Suade Skill Coach: unparseable classification, treating as none:", err.message);
    return { category: "none", targetSection: null, insertText: null };
  }
}

app.post("/api/skill-coach/classify", async (req, res) => {
  try {
    const { matterId, skillId, skillName, priorOutput, lawyerMessage, lawyerId } = req.body;

    if (!skillId || !SKILL_ID_RE.test(skillId)) {
      return res.status(400).json({ error: "A valid skillId is required." });
    }
    if (!lawyerMessage || !String(lawyerMessage).trim()) {
      return res.status(400).json({ error: "lawyerMessage is required." });
    }

    const loaded = loadSkillMarkdown(lawyerId, skillId);
    if (!loaded) {
      return res.status(404).json({ error: `Skill not found: ${skillId}` });
    }

    const displayName = skillName || skillId;
    const prompt = buildCoachClassifyPrompt({
      displayName,
      skillMarkdown: loaded.content,
      references: loaded.references,
      priorOutput,
      lawyerMessage,
    });

    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = parseCoachJson(textBlock ? textBlock.text : "");
    console.log(
      `Suade Skill Coach: classified follow-up on ${skillId} (matter ${matterId || "n/a"}) as ${parsed.category}` +
        ` -- message: "${String(lawyerMessage).slice(0, 100)}${String(lawyerMessage).length > 100 ? "…" : ""}"`
    );

    if (parsed.category === "none" || !parsed.targetSection || !parsed.insertText) {
      return res.json({ category: "none", skillName: displayName, proposedEdit: null, requiresManualReview: false });
    }

    // Guardrail: proposed edits into Non-Negotiable Rules / Guardrails
    // sections are never auto-applied -- surface for manual review instead.
    if (isProtectedSection(loaded.content, parsed.targetSection)) {
      return res.json({
        category: parsed.category,
        skillName: displayName,
        proposedEdit: null,
        requiresManualReview: true,
        targetSection: parsed.targetSection,
      });
    }

    res.json({
      category: parsed.category,
      skillName: displayName,
      proposedEdit: {
        targetSection: parsed.targetSection,
        insertText: parsed.insertText,
        category: parsed.category,
      },
      requiresManualReview: false,
    });
  } catch (err) {
    console.error("Suade Skill Coach classify error:", err);
    res.status(500).json({ error: err.message || "Unknown classification error." });
  }
});

// ---------------------------------------------------------------------------
// Edit rationale: after Suade inserts a draft and the lawyer edits it, infer
// WHY the edit was made and phrase it as a yes/no question the lawyer can
// confirm. Same shape as Skill Coach classify -- tagged context in, strict
// JSON out, safe fallback -- and synchronous, since a single section's
// before/after is a small, bounded call.
// ---------------------------------------------------------------------------

// Attorney editing-intent taxonomy for arbitration statements of claim.
// Flat primary-intent labels, each paired with the attorney's underlying
// concern -- fed to the model so it classifies against real practitioner
// intent, and used to sharpen the yes/no question. Source: "A taxonomy of
// attorney editing intents." Bump TAXONOMY_VERSION on any label change so
// the labeled corpus stays analyzable across revisions.
const TAXONOMY_VERSION = "attorney-intents-v1";

const EDIT_RATIONALE_TAXONOMY = {
  jurisdiction:
    "Establishing the tribunal's authority: existence, validity, scope, and applicability of the arbitration agreement; party consent; standing or entitlement to claim.",
  procedural_compliance:
    "Satisfying conditions precedent, notice/escalation requirements, applicable rules and procedural orders, and limitation/timeliness of filing; avoiding waiver or procedural default.",
  claim_sufficiency:
    "Making claims legally complete: selecting viable claims, completing every legal element, distinguishing duties and breaches, removing weak or duplicative claims, pleading facts rather than bare conclusions.",
  case_theory:
    "What the case is fundamentally about: the central wrong, the governing theory, advantageous characterization, and thematic coherence across sections.",
  factual_accuracy:
    "Correcting dates, amounts, actors, events, and attribution; correcting chronology; distinguishing fact from inference; removing factual overreach.",
  evidentiary_support:
    "Anchoring assertions in proof: citation fidelity, selecting the strongest source, identifying evidentiary gaps, authenticity and provenance.",
  chronology: "Making temporal order intelligible and establishing what each party knew at the relevant time.",
  causation:
    "Connecting conduct to consequence and each breach to each loss: counterfactual, intervening causes, reliance and inducement.",
  damages:
    "Heads of loss, quantification methodology, avoiding double recovery, remoteness and foreseeability, mitigation, valuation date and assumptions, interest.",
  defense_anticipation:
    "Anticipating the strongest defense, adverse contractual language, unfavorable authority, and threshold objections; inoculating against predictable attacks.",
  adverse_fact_management:
    "Handling damaging facts fairly and avoiding impeachment material or inconsistency with the record.",
  position_preservation:
    "Avoiding unnecessary admissions or premature factual commitment; preserving alternative claims, amendment flexibility, and reserved rights.",
  remedy_alignment: "Aligning requested relief with the tribunal's powers and making the prayer award-ready.",
  credibility:
    "Calibrating confidence to the evidence; removing exaggeration; demonstrating candor; advocacy rather than invective; ethical accuracy.",
  cognitive_clarity:
    "Managing the tribunal's attention: information hierarchy, reducing inferential distance, propositional headings, roadmaps, paragraph logic, making the award easier to write.",
  materiality:
    "Testing whether each passage earns its place: removing immaterial facts, cumulative support, and issue proliferation; economy and proportionality.",
  internal_consistency:
    "Cross-document, numerical, and terminology consistency; correct cross-references and citation integrity; relief aligned to pleaded claims.",
  linguistic_precision:
    "Actor/action clarity, modality (may/must/shall), quantifiers, removing syntactic ambiguity, tracking operative contractual language.",
  confidentiality: "Handling redactions, confidentiality designations, personal data, and privilege correctly.",
  enforcement:
    "Framing the claim so the tribunal acts within its mandate and respects due process, supporting enforceability of the eventual award.",
  client_strategy:
    "Advancing the client's actual commercial objective: settlement leverage, reputation and relationships, parallel strategy, cost-benefit, avoiding pyrrhic success.",
  other: "None of the above intents clearly fits.",
};

const EDIT_RATIONALE_CATEGORIES = Object.keys(EDIT_RATIONALE_TAXONOMY);

function buildEditRationalePrompt({ sectionTitle, skillName, matterSummary, before, after, diff }) {
  const diffBlock =
    diff && Array.isArray(diff.changes) && diff.changes.length > 0
      ? JSON.stringify(diff.changes.slice(0, 40))
      : "[]";
  const categoryLines = Object.entries(EDIT_RATIONALE_TAXONOMY)
    .map(([label, def]) => `- "${label}": ${def}`)
    .join("\n");
  return [
    `You are inside Suade, a Word add-in for arbitration lawyers. Suade inserted a clean drafted ` +
      `passage into the "${sectionTitle || "document"}" section of a statement of claim, and the lawyer ` +
      `then edited it by hand. Infer the single most likely REASON the lawyer made this edit, and phrase ` +
      `it as a yes/no question they can confirm.`,
    `Classify the reason into EXACTLY one of these attorney editing-intent categories:\n${categoryLines}`,
    `Also give "subIntent": a short, specific phrase naming the precise intent behind THIS edit, drawn ` +
      `from what the edit actually does (e.g. "Avoid limitation or timeliness defects", "Distinguish fact ` +
      `from inference", "Avoid double recovery", "Calibrate confidence to the evidence"). One phrase, not a sentence.`,
    `Base your inference on the STRUCTURED DIFF and the before/after text. Prefer the most substantive ` +
      `change if several are present. The question must be specific enough that a "yes" is genuinely ` +
      `informative -- reference the concrete change AND the underlying concern (e.g. "Did you change this ` +
      `date to avoid a limitation defect?"), never generic.`,
    `<section_title>\n${sectionTitle || "(unknown)"}\n</section_title>`,
    `<skill>\n${skillName || "(none)"}\n</skill>`,
    ...(matterSummary ? [`<matter_summary>\n${String(matterSummary).slice(0, 1500)}\n</matter_summary>`] : []),
    `<before_text>\n${String(before || "").slice(0, 6000)}\n</before_text>`,
    `<after_text>\n${String(after || "").slice(0, 6000)}\n</after_text>`,
    `<structured_diff>\n${diffBlock}\n</structured_diff>`,
    `Respond with ONLY a JSON object, no other text:\n` +
      `{"category": "...", "subIntent": "...", "predictedRationale": "one concise sentence", ` +
      `"question": "a yes/no question", "confidence": 0.0}`,
  ].join("\n\n");
}

const EDIT_RATIONALE_FALLBACK = {
  category: "other",
  subIntent: null,
  predictedRationale: "",
  question: "Did you make this change deliberately?",
  confidence: 0,
};

function parseEditRationaleJson(text) {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON object in response");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const category = EDIT_RATIONALE_CATEGORIES.includes(parsed.category) ? parsed.category : "other";
    const subIntent =
      typeof parsed.subIntent === "string" && parsed.subIntent.trim() ? parsed.subIntent.trim() : null;
    const question =
      typeof parsed.question === "string" && parsed.question.trim() ? parsed.question.trim() : EDIT_RATIONALE_FALLBACK.question;
    let confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.min(1, Math.max(0, confidence));
    return {
      category,
      subIntent,
      predictedRationale: typeof parsed.predictedRationale === "string" ? parsed.predictedRationale : "",
      question,
      confidence,
    };
  } catch (err) {
    // A malformed prediction must never surface a broken banner -- fall back
    // to a neutral, always-valid question.
    console.error("Suade edit rationale: unparseable prediction, using fallback:", err.message);
    return { ...EDIT_RATIONALE_FALLBACK };
  }
}

app.post("/api/edit-rationale/predict", async (req, res) => {
  try {
    const { editPairId, sectionTitle, skillName, matterSummary, before, after, diff } = req.body;

    if (typeof editPairId !== "string" || !EDIT_PAIR_ID_RE.test(editPairId)) {
      return res.status(400).json({ error: "A valid editPairId is required." });
    }
    if (typeof before !== "string" || typeof after !== "string" || !before.trim() || !after.trim()) {
      return res.status(400).json({ error: "before and after text are required." });
    }

    const prompt = buildEditRationalePrompt({ sectionTitle, skillName, matterSummary, before, after, diff });

    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = parseEditRationaleJson(textBlock ? textBlock.text : "");
    console.log(
      `Suade edit rationale: ${editPairId} in "${sectionTitle || "n/a"}" -> ${parsed.category}` +
        ` (confidence ${parsed.confidence})`
    );
    res.json(parsed);
  } catch (err) {
    console.error("Suade edit rationale predict error:", err);
    res.status(500).json({ error: err.message || "Unknown edit-rationale error." });
  }
});

app.post("/api/skill-coach/commit", (req, res) => {
  try {
    const { lawyerId, skillId, proposedEdit, matterId, sourceMessage } = req.body;

    if (!skillId || !SKILL_ID_RE.test(skillId)) {
      return res.status(400).json({ error: "A valid skillId is required." });
    }
    if (!proposedEdit || !proposedEdit.targetSection || !proposedEdit.insertText) {
      return res.status(400).json({ error: "proposedEdit with targetSection and insertText is required." });
    }
    if (!resolveFirmSkillFile(skillId)) {
      return res.status(404).json({ error: `Skill not found: ${skillId}` });
    }

    ensurePersonalCopy(lawyerId, skillId);
    const personalPath = personalPathFor(lawyerId, skillId);
    const prior = fs.readFileSync(personalPath, "utf8");

    // Re-check the guardrail server-side: even a direct/racy commit call
    // must never write into a protected section.
    if (isProtectedSection(prior, proposedEdit.targetSection)) {
      return res.status(409).json({
        error: "This edit targets a Non-Negotiable Rules / Guardrails section and needs manual review.",
        requiresManualReview: true,
        targetSection: proposedEdit.targetSection,
      });
    }

    const next = applyEditToMarkdown(prior, proposedEdit.targetSection, proposedEdit.insertText);
    const { diff, diffSummary } = buildInsertionDiff(prior, proposedEdit.targetSection, proposedEdit.insertText);

    fs.writeFileSync(personalPath, next);

    const versions = readVersions(lawyerId, skillId);
    const versionId = newVersionId();
    versions.push({
      versionId,
      timestamp: new Date().toISOString(),
      matterId: matterId || null,
      sourceMessage: sourceMessage || null,
      category: proposedEdit.category || null,
      diff,
      diffSummary,
      content: next,
    });
    writeVersions(lawyerId, skillId, versions);

    console.log(`Suade Skill Coach: committed ${versionId} to ${skillId} for ${sanitizeLawyerId(lawyerId)} -- ${diffSummary}`);
    res.json({ newVersionId: versionId, diffSummary });
  } catch (err) {
    console.error("Suade Skill Coach commit error:", err);
    res.status(500).json({ error: err.message || "Unknown commit error." });
  }
});

app.post("/api/skill-coach/undo", (req, res) => {
  try {
    const { lawyerId, skillId, versionId } = req.body;

    if (!skillId || !SKILL_ID_RE.test(skillId)) {
      return res.status(400).json({ error: "A valid skillId is required." });
    }
    if (!versionId) {
      return res.status(400).json({ error: "versionId is required." });
    }

    const versions = readVersions(lawyerId, skillId);
    const index = versions.findIndex((v) => v.versionId === versionId);
    if (index === -1) {
      return res.status(404).json({ error: `Unknown versionId: ${versionId}` });
    }
    if (index === 0) {
      return res.status(400).json({ error: "Cannot undo the baseline version." });
    }

    const prior = versions[index - 1];
    fs.writeFileSync(personalPathFor(lawyerId, skillId), prior.content);

    // The reverted version stays in history; the revert is itself a version.
    versions.push({
      versionId: newVersionId(),
      timestamp: new Date().toISOString(),
      matterId: null,
      sourceMessage: null,
      category: "revert",
      revertOf: versionId,
      diff: null,
      diffSummary: `Reverted: ${versions[index].diffSummary || versionId}`,
      content: prior.content,
    });
    writeVersions(lawyerId, skillId, versions);

    console.log(`Suade Skill Coach: reverted ${skillId} to version before ${versionId} for ${sanitizeLawyerId(lawyerId)}`);
    res.json({ ok: true, revertedToVersionId: prior.versionId });
  } catch (err) {
    console.error("Suade Skill Coach undo error:", err);
    res.status(500).json({ error: err.message || "Unknown undo error." });
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
      .map((d) => {
        const base = d.fileId
          ? `- ${d.filename} (role: ${d.documentRole}) -- attached below as an actual document; its content IS available to you.`
          : `- ${d.filename} (role: ${d.documentRole}) -- NOTE: no file attached (legacy mock reference). Content is NOT available. Do not assume or invent its contents.`;
        return d.documentUrl ? `${base} Citation URL: ${d.documentUrl}` : base;
      })
      .join("\n");
    const anyCitationUrls = uploadedDocuments.some((d) => d.documentUrl);
    parts.push(
      `# Uploaded Documents\n\n${list}` +
        (anyCitationUrls
          ? `\n\nCITATION LINKING: whenever your output cites, quotes, or relies on one of these ` +
            `documents, hyperlink the citation phrase itself -- the document/exhibit reference, ` +
            `e.g. "[Supply Agreement, Clause 11.2](citation-url/view#q=...)" -- using that ` +
            `document's Citation URL in markdown link syntax, with "/view" appended and then a ` +
            `fragment "#q=" followed by the URL-encoded supporting passage: the EXACT text from ` +
            `the document that supports the citation, copied verbatim (max 200 characters -- if ` +
            `the passage is longer, use its first sentence or clause). The viewer highlights that ` +
            `passage for the reader, so verbatim accuracy matters; if you cannot quote verbatim, ` +
            `omit the "#q=" part and link to citation-url/view alone. Link only the minimal ` +
            `citing phrase, never a whole sentence. Applies in BOTH the clean draft and the ` +
            `working notes (including inside table cells). Never invent a URL: only use the ` +
            `Citation URLs listed above, and leave citations to documents without a Citation URL ` +
            `unlinked.`
          : "")
    );
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

  if (skillInstructions) {
    // Two-channel output contract: the task pane shows only the clean
    // draft; the working notes get rendered into a separate .docx.
    parts.push(
      `# Response Format (mandatory)\n\n` +
        `Structure your ENTIRE response as exactly two tagged channels, with nothing outside the tags:\n\n` +
        `<clean_draft>\n` +
        `Only the insert-ready draft text -- the numbered clauses / narrative the Skill's output ` +
        `describes. No gap reports, no checklists, no commentary, no process headings, no ` +
        `explanations of what you did. Write it as PLAIN TEXT exactly as it should read in the ` +
        `pleading: no markdown symbols (no #, no ** or * emphasis markers, no backticks, no ` +
        `bullet markers) -- the ONLY markdown permitted in this channel is citation links ` +
        `[phrase](url) where citation linking applies.\n` +
        `</clean_draft>\n\n` +
        `<working_notes>\n` +
        `Everything else the Skill's Output Package calls for: gap reports, verification ` +
        `checklists, source/fact tables, flags, caveats, open questions. Use markdown headings ` +
        `and bullet/numbered lists. If there is genuinely nothing beyond the draft, leave this ` +
        `tag empty.\n` +
        `</working_notes>`
    );
  }

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
