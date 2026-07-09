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

// Per-lawyer personal Skill copies + their version history (Skill Coach).
const PERSONAL_SKILLS_DIR = path.join(__dirname, "skills", "personal");
const SKILL_ID_RE = /^[a-z0-9-]+$/;

const COACH_CATEGORIES = ["new_step", "new_checklist_item", "domain_insight", "best_practice", "none"];

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
const skillRuns = new Map(); // runId -> { status: "pending" | "done" | "error", output?, error?, createdAt, trace }

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

app.delete("/api/upload-document/:fileId", async (req, res) => {
  try {
    await anthropic.beta.files.delete(req.params.fileId, { betas: [FILES_API_BETA] });
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

function firmDefaultPathFor(skillId) {
  return path.join(SKILLS_DIR, `${skillId}.md`);
}

function personalPathFor(lawyerId, skillId) {
  return path.join(PERSONAL_SKILLS_DIR, sanitizeLawyerId(lawyerId), `${skillId}.md`);
}

function versionsPathFor(lawyerId, skillId) {
  return path.join(PERSONAL_SKILLS_DIR, sanitizeLawyerId(lawyerId), `${skillId}.versions.json`);
}

/** Personal copy if one exists for this lawyer, else the firm default. */
function loadSkillMarkdown(lawyerId, skillId) {
  const personalPath = personalPathFor(lawyerId, skillId);
  if (fs.existsSync(personalPath)) {
    return { content: fs.readFileSync(personalPath, "utf8"), source: "personal" };
  }
  const firmPath = firmDefaultPathFor(skillId);
  if (!fs.existsSync(firmPath)) {
    return null;
  }
  return { content: fs.readFileSync(firmPath, "utf8"), source: "firm-default" };
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

  const firmPath = firmDefaultPathFor(skillId);
  const content = fs.readFileSync(firmPath, "utf8");
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
      skillInstructions = loaded.content;
      skillSource = loaded.source;
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
    const output = textBlock ? textBlock.text : "";
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    addTrace(runId, `Response complete: ${output.length.toLocaleString()} characters in ${seconds}s`);

    // Mutate rather than replace so the accumulated trace survives; bump
    // createdAt so the TTL sweep counts from completion, not run start.
    const run = skillRuns.get(runId);
    if (run) {
      run.status = "done";
      run.output = output;
      run.createdAt = Date.now();
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
        output,
      })}\n`
    );
  } catch (err) {
    console.error("Suade backend error:", err);
    const errorMessage = err.message || "Unknown server error.";
    addTrace(runId, `Error: ${errorMessage}`);
    const run = skillRuns.get(runId);
    if (run) {
      run.status = "error";
      run.error = errorMessage;
      run.createdAt = Date.now();
    }
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
    res.status(500).json({ error: err.message || "Unknown intake error." });
  }
});

// ---------------------------------------------------------------------------
// Skill Coach: a lawyer's follow-up message after a Skill run can update
// that Skill going forward (classify -> commit -> undo).
// ---------------------------------------------------------------------------

function buildCoachClassifyPrompt({ displayName, skillMarkdown, priorOutput, lawyerMessage }) {
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

app.post("/api/skill-coach/commit", (req, res) => {
  try {
    const { lawyerId, skillId, proposedEdit, matterId, sourceMessage } = req.body;

    if (!skillId || !SKILL_ID_RE.test(skillId)) {
      return res.status(400).json({ error: "A valid skillId is required." });
    }
    if (!proposedEdit || !proposedEdit.targetSection || !proposedEdit.insertText) {
      return res.status(400).json({ error: "proposedEdit with targetSection and insertText is required." });
    }
    if (!fs.existsSync(firmDefaultPathFor(skillId))) {
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
