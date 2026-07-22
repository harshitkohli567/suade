/**
 * Step-completion eval for the Factual Background skill (v1).
 *
 * Answers ONE question: did the run perform every required step completely,
 * producing each step's required artifact? It does NOT judge whether the
 * legal analysis or drafting is good -- only whether the record is complete.
 * Spec: "Eval v1 for the Factual Background skill: Step-Completion Check".
 *
 * Hybrid: an LLM judge reads the clean draft + working notes and scores each
 * of the 16 steps; then deterministic guards override the mechanical checks
 * (unresolved template placeholders, and the count equalities the spec
 * defines) that a model shouldn't be trusted to get exactly right.
 */

const FACTUAL_BACKGROUND_SKILL_ID = "factual-background";

const STEP_NAMES = {
  1: "Matter Intake",
  2: "Document Collection",
  3: "Document Index",
  4: "Relevance Assessment",
  5: "Extract and Cull Facts",
  6: "Contradiction Detection",
  7: "Adverse-Fact Detection",
  8: "Targeted Re-Review",
  9: "Exclude Irrelevant Documents",
  10: "Structure the Record",
  11: "Draft the Section",
  12: "Citation Hyperlinks",
  13: "Log Dispositions",
  14: "Verification Sweep",
  15: "Assemble Output Channels",
  16: "Present the Output",
};

const VALID_STATUSES = ["complete", "partial", "missing", "blocked"];

// Per-step completion criteria, faithful to the eval spec. Fed to the judge
// so it scores against these exact requirements, not its own idea of "good".
const STEP_CRITERIA = `
Step 1 - Matter Intake. Complete when a Matter Setup Prompt is available (or the run explicitly requests one) AND the matter and the client's objective are identified.
Step 2 - Document Collection. Complete when the number of documents received is recorded, every received document is reviewed (documents received = documents reviewed), and every document has either a canonical source URL or an unresolved-URL flag.
Step 3 - Document Index. Complete when every received document has exactly one index row; every row has Doc ID, Title, Date (or DATE UNCERTAIN flag), Parties named, and Source URL (or unresolved-URL flag); Doc IDs are unique; rows are chronologically ordered. (index rows = documents received)
Step 4 - Relevance Assessment. Complete when every indexed document is assessed with Yes/No across all 10 relevance parameters and an overall relevant/irrelevant result. (relevance rows = index rows)
Step 5 - Extract and Cull Facts. Complete when the introductory fact summary exists AND the fact table exists AND every fact row has Fact ID, Fact title, a neutral factual proposition, source document, and a pinpoint citation.
Step 6 - Contradiction Detection. Complete when the review was performed and either every identified contradiction has Proposition A + source, Proposition B + source, classification, explanation, confidence, additional-evidence-needed, OR an explicit zero-result is recorded. "None found" still counts as complete only if it is explicitly recorded.
Step 7 - Adverse-Fact Detection. Complete when the review was performed and either every adverse fact has target proposition, adverse fact, source, effect on narrative, opponent's likely use, available explanation, classification, recommended treatment, confidence, additional-evidence-needed, OR an explicit zero-result is recorded.
Step 8 - Targeted Re-Review. Complete when a reviewed-or-not-found result is recorded for ALL nine categories: (1) first notice of contract violation, (2) first notice of product defect, (3) date the other side was notified, (4) initial damages amount, (5) other side's response/defence, (6) client's technical report, (7) opposing side's technical report, (8) client's final demand, (9) request for arbitration. A category may be "not found" but cannot be omitted.
Step 9 - Exclude Irrelevant Documents. Complete when every indexed document is classified relevant or excluded, every excluded document has a recorded reason, and no document silently disappears. (relevant + excluded = indexed)
Step 10 - Structure the Record. Complete when BOTH the exhibit numbering map (Doc ID, exhibit reference, description, source URL) AND the sub-header architecture (letter, heading, legal-theory element supported) are produced.
Step 11 - Draft the Section. Complete when a clean draft exists, paragraphs are numbered sequentially, the narrative follows the chronology, each paragraph maps internally to the facts used, and no excluded fact is used in the draft.
Step 12 - Citation Hyperlinks. Complete when required factual assertions carry source hyperlinks, every URL matches an approved matter source URL, no fabricated URL appears, hyperlinks sit on source-identifying text, and no bare parenthetical exhibit citations are used.
Step 13 - Log Dispositions. Complete when every relevant fact omitted from the draft has a disposition, every contradiction has a disposition, and every adverse fact has a disposition. (relevant facts = facts used in draft + facts with omission dispositions)
Step 14 - Verification Sweep. Complete when a pass/fail result is recorded for all five checks: grounding, completeness, consistency, citability, link.
Step 15 - Assemble the Two Output Channels. Complete when Channel 1 is the clean draft only, Channel 2 is the working-notes content, every required section is populated (or shows the approved empty state), no raw template placeholders remain, no tabs added/removed, and the HTML is valid.
Step 16 - Present the Output. Complete when the clean draft is presented inline, exactly one working-notes link is presented pointing to Channel 2, and working-notes tables/logs are not mixed into the clean draft.
`.trim();

// Steps for which the judge should also return extracted integer counts, so
// the spec's count equalities can be checked in code rather than trusted to
// the model's arithmetic.
const COUNT_FIELDS_HINT = `
For the steps below, also include a "counts" object with these integer fields (use your best reading of the working notes; omit a field only if it genuinely cannot be determined):
- Step 2: {"documents_received": N, "documents_reviewed": N}
- Step 3: {"index_rows": N}
- Step 4: {"relevance_rows": N}
- Step 9: {"indexed": N, "relevant": N, "excluded": N}
- Step 13: {"relevant_facts": N, "facts_used_in_draft": N, "facts_with_omission_disposition": N}
`.trim();

function buildEvalPrompt({ cleanDraft, workingNotes, uploadedDocCount, matterId }) {
  return [
    `You are a strict QA evaluator for "Suade", a Word add-in for arbitration lawyers. The ` +
      `Factual Background skill just produced the CLEAN DRAFT and WORKING NOTES below. Your job is a ` +
      `STEP-COMPLETION CHECK: for each of the skill's 16 steps, decide whether the required artifacts ` +
      `were actually produced. Do NOT judge whether the legal analysis or writing is good -- only ` +
      `whether each step's required output exists and is complete.`,
    `Give the model NO credit for merely claiming a step was done -- the required artifact must be ` +
      `present in the clean draft or working notes. A step is still "complete" when it was performed ` +
      `and nothing was found, PROVIDED an explicit zero-result is recorded (e.g. "no contradictions ` +
      `found"). Never mark a step complete just because nothing turned up without that explicit record.`,
    `Use EXACTLY one status per step:\n` +
      `- "complete": every required part of the step is present\n` +
      `- "partial": the step's artifact exists but one or more required parts are missing\n` +
      `- "missing": there is no evidence the step was performed\n` +
      `- "blocked": the step could not be completed because required information was unavailable`,
    `Completion criteria per step:\n${STEP_CRITERIA}`,
    COUNT_FIELDS_HINT,
    `Context: ${uploadedDocCount != null ? `${uploadedDocCount} document(s) were uploaded to this matter` : "the document count provided to the run is unknown"}${matterId ? ` (matter ${matterId})` : ""}.`,
    `<clean_draft>\n${String(cleanDraft || "").slice(0, 20000)}\n</clean_draft>`,
    `<working_notes>\n${String(workingNotes || "").slice(0, 40000)}\n</working_notes>`,
    `Respond with ONLY a JSON object, no other text:\n` +
      `{"steps": [{"step_number": 1, "status": "complete", "failed_checks": ["short reason", ...], "counts": {}}, ... all 16 steps ...]}\n` +
      `"failed_checks" lists the specific missing parts (empty array when complete). Include every step 1-16 exactly once.`,
  ].join("\n\n");
}

function coerceCounts(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Normalizes the judge's JSON into exactly 16 well-formed step records. */
function parseEvalJson(text) {
  let parsedSteps = [];
  try {
    const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON object in response");
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (Array.isArray(obj.steps)) parsedSteps = obj.steps;
  } catch (err) {
    console.error("Suade skill-eval: unparseable judge output, marking steps missing:", err.message);
  }

  const byNumber = new Map();
  for (const s of parsedSteps) {
    const num = Number(s && s.step_number);
    if (Number.isInteger(num) && num >= 1 && num <= 16) byNumber.set(num, s);
  }

  const steps = [];
  for (let n = 1; n <= 16; n++) {
    const raw = byNumber.get(n) || {};
    const status = VALID_STATUSES.includes(raw.status) ? raw.status : "missing";
    const failedChecks = Array.isArray(raw.failed_checks)
      ? raw.failed_checks.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim())
      : [];
    steps.push({
      step_number: n,
      step_name: STEP_NAMES[n],
      status,
      failed_checks: failedChecks,
      counts: coerceCounts(raw.counts),
    });
  }
  return steps;
}

const PLACEHOLDER_PATTERNS = [/<!--\s*INJECT/i, /\{\{\s*MATTER_NAME\s*\}\}/, /\{\{\s*GENERATED_TIMESTAMP\s*\}\}/, /\{\{[A-Z_]+_COUNT\}\}/];

/** Downgrades a step to partial (never upgrades), recording why. */
function downgrade(step, reason) {
  if (step.status === "complete") step.status = "partial";
  if (!step.failed_checks.includes(reason)) step.failed_checks.push(reason);
}

/**
 * Applies the mechanical checks in code: exact-string template placeholders,
 * and the count equalities from the spec (using the judge's extracted counts
 * plus the known uploaded-document count). These only ever downgrade.
 */
function applyDeterministicGuards(steps, { workingNotes, uploadedDocCount }) {
  const byNum = new Map(steps.map((s) => [s.step_number, s]));
  const notes = String(workingNotes || "");

  // Step 15: unresolved template placeholders must not survive.
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(notes))) {
    downgrade(byNum.get(15), "Unresolved template placeholder(s) present in working notes");
  }

  const eq = (a, b) => typeof a === "number" && typeof b === "number" && a === b;
  const c = (num, key) => byNum.get(num).counts[key];

  // Step 2: documents received = reviewed; and, when we know the true upload
  // count, received = uploaded.
  if (typeof c(2, "documents_received") === "number" && typeof c(2, "documents_reviewed") === "number" && !eq(c(2, "documents_received"), c(2, "documents_reviewed"))) {
    downgrade(byNum.get(2), `documents received (${c(2, "documents_received")}) != documents reviewed (${c(2, "documents_reviewed")})`);
  }
  if (typeof uploadedDocCount === "number" && uploadedDocCount > 0 && typeof c(2, "documents_received") === "number" && !eq(c(2, "documents_received"), uploadedDocCount)) {
    downgrade(byNum.get(2), `documents received (${c(2, "documents_received")}) != documents uploaded to Suade (${uploadedDocCount})`);
  }

  // Step 3: index rows = documents received.
  if (typeof c(3, "index_rows") === "number" && typeof c(2, "documents_received") === "number" && !eq(c(3, "index_rows"), c(2, "documents_received"))) {
    downgrade(byNum.get(3), `index rows (${c(3, "index_rows")}) != documents received (${c(2, "documents_received")})`);
  }

  // Step 4: relevance rows = index rows.
  if (typeof c(4, "relevance_rows") === "number" && typeof c(3, "index_rows") === "number" && !eq(c(4, "relevance_rows"), c(3, "index_rows"))) {
    downgrade(byNum.get(4), `relevance rows (${c(4, "relevance_rows")}) != index rows (${c(3, "index_rows")})`);
  }

  // Step 9: relevant + excluded = indexed.
  if (typeof c(9, "relevant") === "number" && typeof c(9, "excluded") === "number" && typeof c(9, "indexed") === "number" && c(9, "relevant") + c(9, "excluded") !== c(9, "indexed")) {
    downgrade(byNum.get(9), `relevant (${c(9, "relevant")}) + excluded (${c(9, "excluded")}) != indexed (${c(9, "indexed")})`);
  }

  // Step 13: relevant facts = facts used in draft + facts with omission disposition.
  if (
    typeof c(13, "relevant_facts") === "number" &&
    typeof c(13, "facts_used_in_draft") === "number" &&
    typeof c(13, "facts_with_omission_disposition") === "number" &&
    c(13, "relevant_facts") !== c(13, "facts_used_in_draft") + c(13, "facts_with_omission_disposition")
  ) {
    downgrade(byNum.get(13), `relevant facts (${c(13, "relevant_facts")}) != used (${c(13, "facts_used_in_draft")}) + omission-disposed (${c(13, "facts_with_omission_disposition")})`);
  }

  return steps;
}

/** PASS only when all 16 are complete; BLOCKED if any blocked; else FAIL. */
function computeOverall(steps) {
  const summary = { complete: 0, partial: 0, missing: 0, blocked: 0, total: steps.length };
  for (const s of steps) summary[s.status] += 1;
  let overall = "PASS";
  if (summary.blocked > 0) overall = "BLOCKED";
  else if (summary.partial > 0 || summary.missing > 0) overall = "FAIL";
  return { overall, summary };
}

module.exports = {
  FACTUAL_BACKGROUND_SKILL_ID,
  buildEvalPrompt,
  parseEvalJson,
  applyDeterministicGuards,
  computeOverall,
};
