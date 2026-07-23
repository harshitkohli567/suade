# Suade — Product & Technical Specification

**Status:** Living document — describes the currently shipped product (the `suade-addin` repo).
**Last updated:** 23 July 2026.
**Audience:** product, engineering, and technical reviewers (investors / prospective users).

---

## 1. What Suade is

Suade is **contextually-aware, point-of-work AI for arbitration lawyers**, delivered as a **Microsoft Word add-in**. Instead of a separate chatbot the lawyer copy-pastes to and from, Suade lives in the Word task pane, understands *where the lawyer is* in a Statement of Claim, and drafts, checks, and learns from their work in place.

**The wedge:** most "AI for lawyers" is a detached chat window. Suade's differentiator is that it operates inside the real drafting surface — inserting as tracked changes, reading the lawyer's own edits, and running section-specific expertise — and quietly builds a proprietary dataset of expert legal edits as it's used.

---

## 2. What Suade does (product capabilities)

### 2.1 Matter setup & document ingestion
- **Matter detection / intake.** A matter can be detected from an existing document or created from a blank document via a short intake description; matters carry an id, parties, and metadata (backed by a CSV matter repository plus an "extras" store).
- **Document upload.** The lawyer uploads the underlying case files — **contracts, exhibits (PDF), and Outlook emails (`.msg`)** — scoped to a resolved matter. Suade extracts text, uploads the file to the AI provider's Files API for grounded drafting, and keeps a hosted copy so citations can resolve to the original source.
- **Citation viewer.** Uploaded sources are viewable via a hosted preview (PDF / text) that a citation hyperlink can point to.

### 2.2 Point-of-work skill surfacing
- **Section detection.** Suade parses the document's structure (roman-numeral and lettered headings, paragraph signals) to know which pleading section the cursor is in, and surfaces the relevant drafting Skill — no prompt box required.
- **Skill library.** Eleven section-level Skills covering a Statement of Claim: *Description of Parties, Brief Summary of Facts, Jurisdiction & Applicable Law, Factual Background, Main Proposition, Breach, Causation, Quantum of Loss, Interest, Evidence Relied Upon, Relief Sought.*

### 2.3 Skill runs (drafting)
- A run takes the selected Skill, the matter, the **active section's on-page text**, the uploaded documents, and an optional message, and produces a section draft grounded in the case materials.
- **Two-channel output.** Skills return (1) a **clean draft** — only the filing text — and (2) **working notes** — the analytical record (document index, fact tables, contradiction/adverse-fact logs, dispositions, gap report), rendered as a downloadable Word document.
- **Long-run handling.** A run executes in the background on the server; the pane polls for the result, so a multi-minute generation never trips Word's ~60-second request timeout.

### 2.4 Insertion into the document
- The clean draft inserts as a **tracked change** (redline) the lawyer accepts or rejects — nothing is added silently.
- Each insertion is wrapped in an **invisible tagged content control** so Suade can find and track that exact passage across later edits.
- Prose paragraphs are **justified** on insertion (lists left-aligned); markdown constructs (links, bold, lists, headings) are converted to native Word formatting.

### 2.5 Edit-rationale capture (the learning loop)
- After the lawyer edits an inserted draft, Suade computes a **word-level diff** against the draft and asks the AI to infer *why* the edit was made, classified against a **21-label arbitration attorney editing-intent taxonomy** (jurisdiction, procedural compliance, factual accuracy, evidentiary support, causation, damages, credibility, materiality, etc.) plus a free-text sub-intent.
- It surfaces a single **inline yes/no question** ("Did you change this to avoid a limitation defect?") the lawyer confirms with one click.
- Detection is **continuous**: each subsequent edit is judged incrementally against the previous state, so every edit gets its own rationale.
- Every confirmation is written to a **labeled corpus** (edit → predicted reason → yes/no) — the raw material for measuring and improving draft quality.

### 2.6 Run-quality evaluation
- For Skills with a defined rubric (v1: **Factual Background**), Suade runs an automated **step-completion check**: a second AI pass judges whether the run produced every required artifact across the Skill's 16 steps, combined with **deterministic guards** (template-placeholder checks and count equalities).
- The result renders as a clean **Step → Status scorecard** (Complete / Partial / Missing / Blocked) with an overall **PASS / FAIL / BLOCKED** verdict, directly below the output.

### 2.7 Skill Coach
- The lawyer's natural-language follow-ups are classified and can be committed as edits to *their personal copy* of a Skill (versioned, with undo) — so corrections apply going forward without engineering.

### 2.8 The data flywheel
- Four append-only corpora accumulate from day one: **edit pairs** (model draft vs. inserted text), **rationale signals** (edit → confirmed reason), **skill-run records**, and **skill evals**. These are the foundation for eval-driven quality improvement.

---

## 3. Technical architecture

```
[ Microsoft Word + Suade task pane ]   <-- React/TS via Office.js
              |  requests (drafts, edits, uploads)
              v
[ Suade server: Node + Express on Render ]
       |  Skills (Markdown)   |  case documents        |  labeled corpus (logs)
       v                      v (Files API upload)      ^ (edits + decisions)
[ Anthropic Claude — Sonnet 5 ]  <----- grounded drafting, editing-intent, LLM-as-judge
```

### 3.1 Client — the Word add-in
- **Stack:** TypeScript 5.4, React 18 (hooks, no UI framework), **Office.js** targeting the **WordApi 1.4** requirement set; bundled with Webpack 5.
- **Word integration (the hard part):**
  - **Tracked changes** — insertions land under `ChangeTrackingMode.trackAll`.
  - **Content controls** — hidden, tagged (`suade-ep-<id>`) wrappers that survive edits and let Suade re-read a specific draft.
  - **`getReviewedText`** — reads a control's current text with tracked changes resolved, powering edit-rationale.
  - **`DocumentSelectionChanged`** + heading/paragraph signal parsing — section detection and cursor-aware behavior.
  - Justified paragraph insertion; markdown → native Word (hyperlinks, lists, bold).
- **Edit-rationale trigger:** a ~1.5s **poll** re-reads each tracked draft (whitespace-tolerant settle detection), adopts drafts already in the document, advances the baseline after each prediction, and times out stalled requests so the watcher can't wedge.

### 3.2 Server — API + orchestration
- **Stack:** Node.js (≥18) + Express 4. One deployable serves the built task pane (static) and the JSON API.
- **Run model:** skill runs and evals execute in the background keyed by a `runId`; the client polls a status endpoint. In-memory run maps carry a 30-minute TTL sweep.
- **Persistence (current):** append-only JSONL logs — `edit-pairs.log`, `skill-runs.log`, `skill-evals.log`, `skill-feedback.log`. No database yet (deliberately simple).
- **Document processing:** `mammoth` (.docx → text), `pdfjs-dist` (PDF), `@kenjiuno/msgreader` (`.msg` email), and `docx` for generating the working-notes document.

### 3.3 AI layer
- **Model:** **Anthropic Claude Sonnet 5** (`claude-sonnet-5`) via the official `@anthropic-ai/sdk` (beta Messages API).
- **Features in use:**
  - **Adaptive extended thinking** + **effort control** (`output_config.effort`) on every call.
  - **Streaming** with `.finalMessage()` for long generations — skill runs at **64K max output tokens**, the eval judge at **20K** (streaming is required above the SDK's non-streaming time ceiling).
  - **Files API** (`beta.files.upload`, `files-api-2025-04-14`) — uploaded case documents are referenced by `file_id`; they live in the provider account, not re-sent per call.
  - **LLM-as-judge** — the run-quality eval is a second, rubric-scored model call (hybrid with deterministic checks).
- **Retry:** transient API errors (429 / 5xx / overloaded) are retried with backoff, surfaced only as trace entries.

### 3.4 Skills system
- Each Skill is a **versioned Markdown file** plus reference files (protocols, templates, domain knowledge), rendered into the run prompt. Domain expertise is edited in these files — not in code — which is how it scales. A per-lawyer personal copy overlay supports Skill Coach edits.

### 3.5 Data model / corpus
- **Edit pairs** — model draft vs. lawyer's inserted text, captured at insert time, tied to a content-control id.
- **Rationale signals** — `{ editPairId, section, skill, matter, category, subIntent, predictedRationale, question, confidence, answer, diffSummary, taxonomyVersion, timestamps }`.
- **Skill-run records** — which Skill produced which output for which matter.
- **Skill evals** — per-step statuses + overall verdict + counts.

---

## 4. API surface

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/upload-document` | Upload + parse a case file; push to Files API |
| GET | `/api/documents/:token` / `/view` | Hosted source + citation preview |
| DELETE | `/api/upload-document/:fileId` | Remove an uploaded document |
| POST | `/api/run-skill` | Start a background skill run → `runId` |
| GET | `/api/run-skill/:runId` | Poll run status/result |
| POST | `/api/skill-eval` | Start a background run eval → `evalRunId` |
| GET | `/api/skill-eval/:evalRunId` | Poll eval status/result |
| POST | `/api/edit-pairs` / `/update` / `/rationale` | Capture edit pairs + rationale signals |
| POST | `/api/edit-rationale/predict` | Predict why an edit was made |
| POST | `/api/matter-intake` | Create a matter from a description |
| GET | `/api/matters-extra` | Supplemental matter data |
| POST | `/api/skill-coach/classify` / `/commit` / `/undo` | Coach a Skill from follow-ups |
| POST | `/api/skill-feedback` | Thumbs / feedback capture |

---

## 5. Key technical parameters

| Parameter | Value |
|---|---|
| AI model | `claude-sonnet-5` |
| Max output — skill run / eval | 64,000 / 20,000 tokens (streamed) |
| Files API beta | `files-api-2025-04-14` |
| Run store TTL | 30 minutes |
| Word requirement set | WordApi 1.4 |
| Node | ≥ 18 |
| Deployment | Render (single web service; `ANTHROPIC_API_KEY` env secret) |
| Dev topology | Task pane `https://localhost:3000` · API `https://localhost:3001` |

---

## 6. Notable engineering decisions

- **Background-run + poll** everywhere the model call can exceed Word's ~60s webview timeout.
- **Streaming for large budgets** — the SDK rejects non-streaming calls that could exceed 10 minutes; skill runs and the eval judge stream and collect the final message.
- **Content controls as durable anchors** — the only reliable way to track a specific inserted passage across arbitrary later edits.
- **Poll-based edit detection** — chosen after a second `DocumentSelectionChanged` handler proved unreliable on the target Word host; the poll reads the same proven content-control API.
- **Hybrid evals** — LLM judgment for semantic steps, deterministic code for exact-string/count checks the model shouldn't be trusted with.

---

## 7. Current limitations & near-term roadmap

- **Bring-your-own-key (BYOK)** — let each lawyer run on their own Claude account/key so their documents and usage stay entirely theirs (prototyped, paused).
- **Eval-driven quality loop** — use the accumulating labeled corpus to score and gate Skill/prompt changes rather than relying on judgment.
- **Persistence hardening** — move the JSONL corpus to a persistent disk / database, and add auth + multi-tenancy.
- **Broader per-Skill evals** — extend step-completion checks beyond Factual Background.
- **Section detection for hand-typed sections** — currently strongest for Suade-inserted content.
- Office.js behaviors that can't be verified headless are validated in live Word.

---

## 8. Dependency summary

**Runtime:** `@anthropic-ai/sdk`, `express`, `cors`, `dotenv`, `react` / `react-dom`, `docx`, `mammoth`, `pdfjs-dist`, `@kenjiuno/msgreader`.
**Build / dev:** `typescript`, `webpack` (+ `ts-loader`, loaders, `html-webpack-plugin`, `copy-webpack-plugin`), `office-addin-*` tooling, `eslint` (+ office/react plugins).
**Built with:** Claude Code (Anthropic's agentic coding CLI) on Claude Opus 4.8, human-in-the-loop.
