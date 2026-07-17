# Suade — Product Requirements Document

**Version:** 1.0 · **Date:** 16 July 2026 · **Status:** Living document — reflects the shipped product, not aspiration.
**Supersedes:** the pre-repo PRD ("v0.3 Decisions Log" era). Legacy FR-numbers referenced in code comments (FR-1…FR-10) are preserved below; capabilities built since are numbered FR-11+.

Each requirement carries a status: **[Built]** shipped and verified · **[In progress]** partially in the working tree · **[Planned]** agreed direction, not started.

---

## 1. Product thesis

Suade is a **self-improving drafting system for arbitration lawyers** that lives inside Microsoft Word. It drafts each section of a pleading from firm playbooks (Skills), grounded in the matter's actual documents, with **verifiable, source-linked citations** — and it **learns from each lawyer's corrections**, so the playbooks improve with use.

Three ideas define it:

1. **Point of work.** Suade operates where drafting happens — a Word task pane that knows the matter, the section under the cursor, and the case documents. Output inserts into the pleading as tracked changes.
2. **Verifiability over fluency.** Outputs cite their sources as hyperlinks that open the actual document with the supporting passage highlighted. Gap reports name what is missing rather than inventing it. Working material is separated from the clean draft.
3. **The instructions are the product.** Skills are versioned, editable documents — not vendor-frozen prompts. A lawyer's follow-up message can durably update a Skill (Skill Coach), and every model-draft-versus-final-text pair is captured as a corpus for future style learning.

## 2. Users and core workflows

**User:** arbitration lawyers drafting pleadings (Statements of Claim first), initially a small trusted group sharing one deployment.

**Workflow A — existing document.** Open a drafted/partial pleading → Detect Matter (from matter ID or party names in the text) → upload case documents → run a Skill for the current section → review the clean draft, open the working-notes Word doc → insert into the section as tracked changes → keep editing in Word.

**Workflow B — blank document (intake).** Start from nothing → describe the matter in natural language and attach the client meeting transcript or client email (PDF/DOCX/Outlook .msg) → Suade extracts the matter details, reusing an existing repository matter when the parties match, otherwise creating and persisting a new one → intake materials become the matter's documents → draft section by section; insertion falls back to the cursor when no sections exist yet.

**Workflow C — coaching.** After any Skill run, a follow-up like *"going forward, always check X"* is classified as durable guidance and, unless stopped in a 10-second window, committed as a versioned edit to the lawyer's personal copy of that Skill — used for all their future runs, undoable at any time.

## 3. Architecture

```
Word (desktop) ── task pane (React/TS, Office.js)
                    │  HTTPS
                    ▼
Node/Express backend (server.js)
  ├─ Anthropic API: claude-sonnet-5, adaptive thinking, effort=medium,
  │    max_tokens 16k; Files API (beta) for document reading
  ├─ Filesystem storage (see §6)
  └─ Serves in production: task pane bundle + API + document viewer,
       single origin (Render, plain HTTP behind proxy)
```

- **Dev:** webpack dev server (https://localhost:3000) + backend (https://localhost:3001), office-addin-dev-certs.
- **Prod:** Render web service (starter), `render.yaml` blueprint, `NODE_ENV=production`, deployed from GitHub `main`. Production manifest (`manifest-production.xml`) is sideloaded manually — this is deliberately *not* an AppSource distribution.
- The Anthropic API key lives only in backend env; the task pane never sees it.
- Long operations use **start + poll** (never a single long request): Word's webview aborts requests around 60s.

## 4. Functional requirements

### 4.1 Document context (FR-1) — [Built]
- Track cursor paragraph and detect the active section from bold-heading structure; show paragraph index and active section in the pane.
- Section-detection diagnostics panel, collapsible.
- FR-3 (predicting the right Skill from the section) remains **[Planned]**; Skill selection is a manual dropdown.

### 4.2 Matter layer (FR-8, FR-11) — [Built]
- **Repository:** CSV of firm matters (read-only, in-repo) **merged** with a server-side supplementary store (`matters-extra.json`) of intake-created matters, exposed via `GET /api/matters-extra`. Detection force-reloads so same-session intake matters are findable.
- **Detection tiers:** verbatim matter-ID match auto-resolves; both-party-names match auto-resolves only when exactly one matter fits (either orientation); single-name matches never auto-resolve. The resolved card states the match basis; collapsed, it shows the matter ID.
- **FR-11 Blank-document intake:** instruction + attached client materials → Claude extracts client / side / counterparty / matter type / governing law / seat (never inventing; gaps reported) → match-or-create. New matters get `INTAKE-YYYY-NNNN` IDs and persist server-side. Re-intake of the same parties matches rather than duplicates. Intake uploads park under an `unassigned` pseudo-matter and are reassigned on resolution.

### 4.3 Documents (FR-10, FR-12) — [Built]
- Upload PDF / DOCX / Outlook .msg; multi-file, 3-way concurrent, per-file progress with a failures-only list; remove deletes both the Anthropic file and the hosted copy.
- Anthropic's document blocks accept only PDF and plaintext, so DOCX (mammoth) and MSG (msgreader) are converted to text server-side for Claude; corrupted files fail with clear 422s. Email attachments are listed by name, never silently read.
- **FR-12 Hosted originals:** every upload's *original bytes* are also stored server-side and served at unguessable token URLs (private-link model). Metadata + text extraction stored alongside.

### 4.4 Skill runs (FR-4, FR-6, FR-7) — [Built]
- Skills are markdown playbooks in a **folder-per-skill layout** with optional `references/` subfolders (Agent Skills convention); references are inlined into the prompt so in-skill pointers resolve. Resolution is by filename anywhere under `source/`, so folder names are free-form.
- Run lifecycle: `POST /api/run-skill` returns a runId immediately; the pane polls every 3s (10-min ceiling). A live **Backend activity** trace shows real milestones only (skill loaded + source, documents attached, prompt size, API call, retries, response size/duration, channel split, notes rendering). Elapsed-seconds spinner beside the Enter button.
- Transient Anthropic failures (529 overloaded / 429 / 5xx) retry at 5s/15s/30s spacing, visible in the trace; terminal errors surface in plain English.
- Message-only runs (no Skill selected) are supported; the composer sits below the previous output, chat-style.

### 4.5 Two-channel output & working notes (FR-13) — [Built]
- Skill responses are contractually split: `<clean_draft>` (insert-ready text only, **plain text; citation links are the only permitted markdown**) and `<working_notes>` (gap reports, checklists, tables, flags). Tag-less responses degrade to everything-is-the-draft.
- Working notes render server-side into a formatted **.docx** (Title/heading styles, bullets, numbered lists that restart per list, bold/italic, markdown pipe tables as real Word tables with shaded headers, live hyperlinks incl. in cells) and open as a **new Word document** via `Application.createDocument` — nothing stored unless the lawyer saves. Rendering failure falls back to inline display; nothing is ever lost.

### 4.6 Verifiable citations (FR-14) — [Built]
- Prompts list each attached document's citation URL. Claude must hyperlink the **minimal citation phrase** (never a whole sentence) and append `#q=` + a ≤200-char **verbatim** supporting quote.
- The viewer (`/api/documents/:token/view`): PDFs render in-browser via bundled PDF.js with the quoted passage highlighted and scrolled into view; DOCX/MSG show the stored text extraction with the passage marked, plus "Download original". Quote matching degrades exact → normalized → first-8-words → a visible "not found" banner. The quote travels in the URL *fragment*, so quoted client text never reaches server logs.

### 4.7 Insertion (FR-7.2/7.4, FR-15) — [Built]
- Insert at the end of the detected section, or at the cursor when no section exists (blank documents); always as tracked changes; success message states where it landed.
- No markdown artifacts may reach the pleading: bold/italic/backticks convert to real formatting, `#` headings become bold paragraphs (Word Heading styles would fight the document's numbering), bullets become Word lists, citation links become live hyperlinks. **Literally numbered clauses stay literal** — auto-numbering would silently renumber a pleading. Fully plain drafts use direct paragraph insertion for best formatting inheritance.

### 4.8 Skill Coach (FR-16) — [Built]
- After a run, the next message is classified (in parallel; never blocks the run) into `new_step` / `new_checklist_item` / `domain_insight` / `best_practice` / `none` — durable-for-every-matter is the bar; **bias to `none`**; malformed classifications are treated as `none` (a bad parse must never mutate a Skill). Decisions are logged with a message snippet.
- Non-`none`: indicator with category label + **Stop** button for a 10s grace window, then auto-commit; a persistent toast offers **Undo**.
- Commits go to a **per-lawyer personal copy** (cloned from the firm default on first edit; personal copies take precedence in runs and later coaching; they fork only the main file and keep following firm reference files). Full version history: timestamp, matter, verbatim source message, category, diff; undo reverts while keeping the reverted version in history.
- **Guardrails:** edits targeting *Non-Negotiable Rules* / *Guardrails* sections are never auto-applied — classify returns `requiresManualReview`, commit independently refuses (409).

### 4.9 Feedback & learning corpus (FR-2.1, FR-17) — [Built / In progress]
- Thumbs up/down on output, logged with the run's actual context (skill, matter, section, document IDs). [Built]
- Minimal Activity Graph: every completed run logged (runId, skill, matter, timestamp, both channels). [Built]
- **FR-17 Edit-pair corpus:** at Insert, log (model draft → text actually inserted) with metadata; unedited acceptance is itself signal. Nothing consumes the corpus yet — it exists because it can't be backfilled. [Built]
- **FR-17b Post-insert capture:** because the observed real workflow is *"insert first, edit in Word"*, inserted drafts are wrapped in hidden, tagged content controls; the pane re-reads them (every 60s while open, plus before each run) using the tracked-changes-accepted view of the text, and appends `final-update` snapshots when a draft changed — last snapshot wins downstream. Emptied/deleted drafts are skipped, never logged as empty finals. **[Built]** *(content-control + reviewed-text behavior pending live-Word verification, per §8)*

### 4.10 Operations & UX chrome — [Built]
Backend health endpoint + status dot with actionable message; document-context error surfacing; collapsible cards throughout; friendly error copy everywhere a raw API error could leak.

## 5. Interface inventory (backend)

| Route | Purpose |
|---|---|
| `GET /api/health` | liveness for the status dot |
| `POST /api/upload-document` · `DELETE /api/upload-document/:fileId?docToken=` | upload (convert + host) / remove everywhere |
| `GET /api/documents/:token` · `GET /api/documents/:token/view` | original bytes · citation-highlight viewer |
| `GET /vendor/pdfjs/*` | bundled PDF.js (no CDN) |
| `POST /api/run-skill` · `GET /api/run-skill/:runId` | start run · poll status/trace/channels |
| `POST /api/skill-coach/classify` · `/commit` · `/undo` | Skill Coach lifecycle |
| `GET /api/matters-extra` · `POST /api/matter-intake` | intake-created matters · blank-doc intake |
| `POST /api/skill-feedback` | thumbs votes |
| `POST /api/edit-pairs` · `POST /api/edit-pairs/update` | corpus: insert event · post-insert snapshots |

**Env:** `ANTHROPIC_API_KEY` (required) · `NODE_ENV=production` + `PORT` (Render) · `SUADE_UPLOADS_DIR` · `SUADE_EDIT_PAIRS_PATH` · `SUADE_SERVER_PORT` (dev).

## 6. Data & storage model

Filesystem, deliberately pre-database:

| Store | Contents |
|---|---|
| `uploads/` | hosted originals + `{token}.json` metadata + `{token}.txt` extractions |
| `skills/personal/{lawyer}/` | coached Skill copies + `*.versions.json` history |
| `matters-extra.json` | intake-created matters |
| `skill-runs.log` / `skill-feedback.log` / `edit-pairs.log` | JSONL: runs / votes / corpus |
| `src/data/skills/source/` (in repo) | firm-default Skills, folder-per-skill + references |
| `matters-source/matters.csv` (in repo) | firm matter repository (read-only) |

> **Critical operational dependency:** on Render the filesystem is ephemeral. Until a persistent disk is attached (mount e.g. `/var/data`; set `SUADE_UPLOADS_DIR`, `SUADE_EDIT_PAIRS_PATH`) every redeploy wipes hosted documents (breaking citation links embedded in pleadings), coached Skills, intake matters, and the corpus. **Currently pending.** Note: personal-skill and matters-extra paths are not yet env-configurable — part of the same hardening task.

## 7. Security & confidentiality posture (honest)

- **No authentication.** Everyone shares the `default-lawyer` identity: one coached-Skill set, one document workspace, one corpus. Structurally per-lawyer already; real identity is future work.
- **Private-by-obscurity links.** Anyone holding a citation URL can open that document — no login. Same model as private Google Doc links; acceptable for a trusted circle, not for leak-catastrophic material.
- **Data flows:** document text and matter facts go to Anthropic's API; files uploaded to the Files API are workspace-scoped to the shared key. Quoted passages in citation URLs stay client-side (fragments). All server logs contain client work product — treat the deployment's disk as confidential.
- **Model-behavior guardrails:** never invent unsupplied evidence (prompted + gap reports); protected Skill sections cannot be auto-edited; citation URLs cannot be fabricated (only listed URLs may be used).

## 8. Known limitations

Scanned/image-only PDFs can't be quote-highlighted (banner explains; no OCR). `.eml` unsupported (only `.msg`). The draft textarea shows raw markdown link syntax (converts on insert). HTML-path insertion may not inherit surrounding fonts perfectly. Skill Coach improvements are per-lawyer; promotion to firm defaults doesn't exist yet. Word-API behaviors are verified by live use, not automated tests. No streaming (trace + polling instead). Section detection is heuristic (bold headings).

## 9. Roadmap

Framed by the **memory hierarchy**: Skills answer *what should be done*, retrieval answers *what is true*, weights answer *how it should sound*. Route lawyer input to the most auditable tier that works.

1. **Now:** attach the Render persistent disk (§6).
2. **Next — retrieval tier:** Firm Precedent Library (past pleadings, model clauses; lexical retrieval first, embeddings swappable later) injected per-run with citation URLs, fully traced. Per-matter documents stay fully attached until size forces selectivity.
3. **Skill promotion:** review flow elevating personal Skill edits into firm defaults — turns the per-lawyer flywheel institutional.
4. **Structural tier, cheap first:** few-shot retrieval over the edit-pair corpus (teach style like a LoRA would — zero training, fully auditable). The memory router (Skill Coach generalized to route context/retrieval/corpus) follows.
5. **Later, deliberately:** fine-tuning only at real corpus scale, style-only, never client facts (frontier Claude isn't customer-tunable; weights are the least auditable tier — a genuine liability in legal). Real auth and per-lawyer/per-client isolation; a database when filesystem stops sufficing.

## 10. Decisions log

| When | Decision |
|---|---|
| 2 Jul | API key server-side only; task pane never calls Anthropic directly |
| 4 Jul | Start+poll for runs (Word ~60s webview abort); trace panel = real milestones only |
| 5 Jul | DOCX/MSG → text extraction server-side (API accepts only PDF/plaintext); originals preserved |
| 8 Jul | Skill Coach: bias-to-none; 10s stop window; protected sections require manual review; per-lawyer copies with versions + undo |
| 9 Jul | Intake = extract-then-match-repo; new matters persist server-side; .msg chosen over .eml (lawyer reality) |
| 14 Jul | Folder-per-skill + `references/` inlined; resolution by filename, layout-agnostic |
| 16 Jul | Two-channel output; working notes = generated .docx opened via createDocument; citations hyperlink hosted originals with `#q=` verbatim quotes (fragment = log privacy); insertion converts/strips all markdown, numbered clauses stay literal; edit-pair corpus captured from day one; post-insert capture required because real workflow is "insert first, edit in Word" |

---
*Maintained in-repo; update alongside the code it describes.*
