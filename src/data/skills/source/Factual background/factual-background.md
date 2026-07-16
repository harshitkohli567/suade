---
name: factual-background
description: "Builds the fact record behind a Statement of Claim's Factual Background section from the underlying document corpus - a chronological document index, fact-by-fact extraction with pinpoint citations, a 10-parameter relevance test, systematic contradiction detection across documents, and adverse-fact identification - then drafts the numbered, exhibit-cited section itself. Output is split into a clean draft and a self-contained interactive HTML working-notes page, built from a fixed template. Use when a lawyer provides a Matter Setup Prompt and a document upload or link (Drive, Dropbox, iManage, or Virtual Data Room) for a new matter, or asks to build a factual summary, statement of facts, chronology, sequence of events, or Factual Background section, or to check case documents for contradictions or adverse facts."
metadata:
  author: Suade
  version: "4.0"
  category: statement-of-claim
---

# Skill: Factual Background

Produces two things: the numbered, exhibit-cited Factual Background
section of the Statement of Claim, and the analytical record underneath
it - document index, fact-by-fact review, contradiction log, and
adverse-fact log - that later sections (Breach, Notice, Causation,
Quantum) will cite back into by paragraph number. The record matters as
much as the prose: an omission here is a hole a later legal section may
silently rely on without support.

**This skill's output always has two separate channels, never one merged
document:**

1. **The clean draft** - only the filing text itself. No flags, no
   tables, no logs, no dispositions.
2. **The working notes** - everything else (document index, fact table,
   relevance scoring, contradiction log, adverse-fact log, exhibit map,
   end notes, gap report), assembled as a single structured package for
   Suade's platform to render as an interactive page, and presented to
   the lawyer as one link. See Steps 15-16.

**CRITICAL:** Never draft a paragraph directly from a read-through of the
documents. Build the Document Index and fact-by-fact review first (Steps
3-5) and draft only from that record (Step 11). If a sentence can't be
traced to a specific document and pinpoint citation, it doesn't go in the
draft.

This skill has three parts: **Steps** (the end-to-end process), a
**Checklist** (quality-control passes to run before finalizing), and
**Domain Knowledge** (industry-specific facts to check for, indexed in
references/domain-knowledge.md).

---

## Part 1: Steps

### Step 1 - Matter Intake

Read the Matter Setup Prompt. If there isn't one, ask the lawyer for a
few lines on what the case is about and what the client wants, and ask
whether they have a client meeting transcript or email to share - these
often surface facts and framing that formal documents don't.

### Step 2 - Document Collection

Using the Matter Setup Prompt to identify the matter, request the full
underlying document corpus - uploaded files, or a link to the matter's
Drive, Dropbox, iManage, or Virtual Data Room. Read every document before
moving to Step 3; don't sample.

**CRITICAL:** Every document must have a canonical, permanent source URL
captured at this step - the in-app exhibit URL Suade assigns on ingest,
not the original Drive/iManage link (those can expire, or require
platform-specific access the reader may not have). This URL is recorded
against the document in the Document Index (Step 3) and carried into the
Exhibit Map (Step 10) - it's what Step 12's citation hyperlinks and Step
15's HTML source links point to. If a document has been provided without
a resolvable source URL, do not proceed to draft a citation to it - flag
it in End Notes instead (Step 15) and note which citations in the draft
are affected.

### Step 3 - Build the Document Index

One row per document, sorted chronologically:

| Doc ID | Title | Date | Parties named (serially numbered) | Source URL |
|---|---|---|---|---|

- **Title.** A unique title of no more than 7 words, summarizing the
  document's contents.
- **Date.** Numeric format only - MM-DD-YYYY (e.g. 1 March 2026 is
  03-01-2026).
- **Parties named.** List each party named in the document, serially
  numbered (e.g. "1. Helios E-Mobility GmbH  2. Castor Energy Storage
  S.p.A.").
- **For a contract**, the operative date is the one in the recitals or
  on the signature page. Where the parties sign on different dates, the
  contract becomes binding on the date of the final signature - not the
  recital date.
- **Source URL.** The canonical URL captured at Step 2 for this
  document. Leave blank only if genuinely unresolvable, and add the
  corresponding End Notes flag (Step 15) - never fabricate one.

**CRITICAL:** If a document is undated or the date is ambiguous (e.g. an
email chain with multiple timestamps), flag it explicitly rather than
guessing - DATE UNCERTAIN. All flags of this kind go in the End Notes
section of the working notes (Step 15) - never inline in the Document
Index or the clean draft.

### Step 4 - Relevance Assessment (10-Parameter Test)

Read the Matter Setup Prompt to understand the party's framing of the
case and construct a working theory of the case. Then assess each
document's relevance from both the client's perspective and the
perspective of what works against the client's case. Score each document
Yes/No against:

1. Event relevance - does it establish that an event occurred?
2. Temporal relevance - does it establish when or in what sequence
   something happened?
3. Actor relevance - does it establish who knew, decided, communicated,
   or acted?
4. Causal relevance - does it help establish why something happened?
5. Legal relevance - does it bear on an element, defense, or applicable
   standard? Legally relevant documents commonly include: a company's
   certificate of incorporation; notarization or stamping of a contract;
   regulatory fee records; anything bearing on whether a document is a
   license or a lease; anything bearing on whether a contract is one for
   work or for service; and anything establishing the manner in which
   notice must be given between the parties (how, and to whom).
6. Theory relevance - does it support or weaken the party's theory of the
   case as framed in the Matter Setup Prompt?
7. Corroboration relevance - does it independently confirm an important
   event or assertion?
8. Context relevance - is it necessary to understand an otherwise
   ambiguous important event?
9. Contradiction relevance - does it contain or reveal a contradiction
   with another document? (Resolved in Step 6.)
10. Adverse-fact relevance - does it contain a fact that would be
    materially adverse if omitted? (Resolved in Step 7.)

A document is relevant if it scores Yes on any of parameters 1-8, or is
implicated in a contradiction (9) or an adverse fact (10). This is the
only relevance category this skill uses - see the note at Step 9 on why
the older "Core/Contextual" labels have been retired.

### Step 5 - Extract and Cull Facts

Using the theory of the case constructed in Step 4, extract facts from
every relevant document. One fact per row, neutral phrasing (what the
document says, not a persuasive spin on it), with a pinpoint citation -
page/paragraph/line/timestamp, not just the document title. Extract facts
that cut against the client's position too; they get resolved in Step 6
or Step 7, not deleted here.

Provide a short introductory paragraph summarizing the key incidents
before the table. Format:

| # | Fact title | Fact | Source |
|---|---|---|---|
| F1 | PSA effective date | PSA effective 1 August 2018; expires 30 June 2019 unless an SOW is ongoing, in which case it continues | D-01, Section 5.1 |
| F2 | Payment when due | Payment due within 10 banking days of invoice under the PSA (absent a contrary SOW term) | D-01, Section 2.2 |

### Step 6 - Contradiction Detection

Before concluding two documents conflict, run the full contradiction
protocol - consult references/contradiction-detection-protocol.md before
doing this step; it is not a formality, the protocol exists specifically
to stop superficial wording differences from being misread as
contradictions. In outline: isolate the specific factual proposition
being tested, extract each document's claim as a discrete proposition,
confirm the two claims are actually comparable (same actor, event, time
period, scope), apply the core test (can both statements be true at the
same time, under the same interpretation of the facts?), and classify the
relationship using the protocol's labels.

**CRITICAL:** Never resolve a contradiction yourself. Log it with both
sources and a confidence level, and let the lawyer decide.

### Step 7 - Adverse-Fact Detection

Before flagging a fact as adverse, run the full adverse-fact protocol -
consult references/adverse-fact-detection-protocol.md before doing this
step. In outline: identify the proposition the draft is asking the reader
to accept, extract precisely what the adverse evidence establishes
(without overstating it), apply the omission test (would a reasonable
reader form a materially different impression if this fact were left
out?) and the opponent-use test (how would opposing counsel fairly use
this against the draft?), then classify and recommend a treatment.

**CRITICAL:** Don't flag every unfavorable fact - only ones that
materially weaken an important proposition, support a plausible competing
explanation, undermine a relied-upon source, or would materially mislead
by omission. Material means something that can genuinely influence the
outcome of the case. Over-flagging buries the real ones.

### Step 8 - Targeted Re-Review of Case-Critical Documents

Regardless of how Steps 4-7 scored them, specifically re-examine any
document establishing:

(a) the first notice of a contract violation
(b) the first notice that a product was defective
(c) the date the other side was notified
(d) the initial amount of damages claimed
(e) the other side's response and initial defence
(f) the client's own technical report, if any
(g) the opposing side's technical report, if any
(h) the client's final demand
(i) the request for arbitration

These documents anchor limitation analysis, breach timing, and quantum in
the sections that cite this one - a gap here propagates downstream.

### Step 9 - Exclude Irrelevant Documents

A document that scored No on all ten Step 4 parameters and produced no
contradiction (Step 6) or adverse fact (Step 7) is not relevant. Exclude
it and note the exclusion - don't just drop it silently from the record.

(Note: earlier versions of this skill tagged individual facts
Core/Contextual/Park. That system is retired - Step 4's 10-parameter test
now does this job at the document level, and Steps 6-7 track
contradictions and adverse facts in their own dedicated logs. "Relevant
fact" in Steps 11-13 below means any fact from a document that survived
this step.)

### Step 10 - Structure the Record

Two things, done together:

- Exhibit Numbering Map - a table of Doc ID -> exhibit reference ->
  document description -> source URL (carried forward from the Document
  Index, Step 3 - don't re-resolve it). If no numbering scheme exists yet
  for this matter, propose one (typically chronological) and flag it as a
  proposal requiring confirmation, since every later section inherits it.
- Sub-header architecture - group the chronology into lettered episodes
  (A, B, C...) at natural breakpoints in the fact pattern (a new phase of
  the relationship, a discrete event, a shift in conduct), not forced
  into a fixed template. For each sub-header, note which element of the
  Legal Theory Brief it primarily supports.

### Step 11 - Draft the Section

Under each sub-header, numbered paragraphs in chronological order, drawn
only from the Step 5 fact review and limited to facts that survived
Step 9:

- **Open with a short, scene-setting paragraph.** Give the reader a
  bird's-eye view of what the case is about before the chronology
  begins. The opening sentence should engage the reader - lead with a
  neutral-sounding fact that quietly sounds the case's legal theme, not
  a dramatic flourish. Aim for "it was the best of times, it was the
  worst of times," not "it was a dark and stormy night."
- **Write flowing narrative, not one fact per line.** Combine related
  facts into a natural paragraph rather than itemizing them - a numbered
  paragraph can synthesize several Step 5 fact rows and should read as
  connected prose, not a checklist. Lead each paragraph with the fact
  that matters and let the surrounding sentence carry supporting detail.
  If a paragraph must include an unfavorable fact, consider opening with
  "although" to subordinate it to its more favorable context.
- **Use time signals, not just dates.** An exact date tells the reader
  "remember this" - use one only when that's actually the intent.
  Otherwise, convey sequence and pace with phrases like "two years
  later" or "just three days before"; words like "next" and "later"
  carry continuity without forcing the reader to track a calendar. Used
  well, this turns the chronology into something closer to a story than
  a log.
- **Lead each paragraph by answering the question the reader is about to
  ask.** Consult references/paragraphs.md for the technique and a
  worked example before drafting - **note its scope**: that file's
  example questions are built for legal argument (what's the standard,
  which courts have done this). For Factual Background, apply the same
  opening-move technique to a factual question instead ("what happened
  next," "who did what," "why does this matter to the story").
- **Divide the narrative with well-drafted sub-headers**, not just
  chronological markers - a heading should tell the reader where the
  section is going and act as a signpost along the way, and present-tense
  verbs give it a more conversational feel. Consult references/headings.md
  for the mechanics of constructing and nesting headings before drafting
  - **note its scope**: that file's four heading *types* (Set order, Set
  points, Even if, Independent) are for legal argument sections and
  assert a legal conclusion. Take only the mechanical guidance (nesting,
  present-tense verbs, signposting) for Factual Background sub-headers,
  never a heading form that asserts a conclusion - see the CRITICAL rule
  below.
- Pinpoint citation on every factual assertion (see Step 12 for format).
- Sequential paragraph numbering, continuing the document's running
  count - this is what later sections cite by (e.g. "as set out at P15
  above"), so it does not go away even though the drafting style above
  is narrative, not itemized.
- **CRITICAL:** No legal characterization - in the prose, in paragraph
  openers, and in sub-headers alike. State what happened; the conclusion
  that it constitutes breach, valid notice, etc. belongs to the sections
  that cite back to these paragraphs. The narrative techniques above
  (scene-setting, time signals, answering the reader's question,
  signposting headings) change how the facts are told, never what
  conclusion is drawn from them.
- Every date, figure, and defined term must match the Brief Summary of
  Facts narrative exactly. If this section surfaces a more precise
  figure than the Brief Summary used, flag the discrepancy for
  reconciliation rather than letting the two silently diverge.

### Step 12 - Cite Sources as Hyperlinks, Not Parentheticals

Every citation in the clean draft is a hyperlink on the source-identifying
text itself, not a plain-text parenthetical.

Good:
> By the [Framework Supply Agreement](SOURCE_LINK) dated 15 March 2022,
> Castor agreed to manufacture and supply, and Helios agreed to purchase,
> HX-9 lithium-ion battery modules.

Bad:
> By the Framework Supply Agreement dated 15 March 2022 (Exhibit C-1),
> Castor agreed to manufacture and supply, and Helios agreed to purchase,
> HX-9 lithium-ion battery modules.

Rules:

1. Identify the words that naturally refer to the source - the
   agreement's name, a document's title, an email's date/description,
   the name of meeting minutes, or the title of a report, memorandum, or
   letter.
2. Apply the hyperlink to that span of text, using the smallest
   meaningful span that clearly identifies the source.
3. Never add a separate parenthetical exhibit citation once the source is
   hyperlinked in the sentence - the link is the citation.
4. The link must resolve to the actual underlying source document - use
   the source_url captured in Step 2 and recorded against that Doc ID in
   the Document Index (Step 3) and Exhibit Map (Step 10).

**CRITICAL:** The citation belongs on the substantive text referring to
the source itself - never rendered as a bare (Exhibit C-1) tacked onto
the end of a clause. The reader opens the source by clicking the words
that name it.

This skill emits standard markdown links (`[text](url)`) in the Channel 1
clean draft. Converting those into native Word hyperlink fields when the
draft is inserted into the document is the task pane's job (an Office.js
insertion step), not something this skill does directly. Channel 2's
source links (Step 15) don't need this conversion - they're written
directly as real `<a href="...">` tags in the HTML template, since that
page is viewed in a browser, not inserted into Word.

### Step 13 - Log Dispositions

Nothing gets excluded or resolved silently. Log an explicit disposition
for:

- Every relevant fact (Step 9) that doesn't appear in the draft - reason
  required.
- Every contradiction from Step 6 - both sources, classification,
  confidence level.
- Every adverse fact from Step 7 - one of: include here neutrally,
  address in a named later section (e.g. Causation), or exclude as
  immaterial (flagged for lawyer confirmation). Default to inclusion or
  deferral, not exclusion - a claimant who has visibly engaged with an
  adverse fact reads better to a tribunal than one whose narrative is
  silent on something the other side will raise anyway.

### Step 14 - Verification Sweep

- Grounding check - every paragraph traces to a specific fact and
  exhibit; nothing asserts more than its citation supports.
- Completeness sweep - every relevant fact from Step 5 either appears in
  the draft or has a Step 13 disposition.
- Consistency check - diff dates, figures, and defined terms against the
  Brief Summary of Facts narrative.
- Citability check - paragraph numbers are sequential and every exhibit
  reference resolves against the Step 10 map.
- Link check - every citation in the draft is a working hyperlink per
  Step 12, not a parenthetical.

### Step 15 - Assemble the Two Output Channels

**Channel 1 - Clean Draft.** The Factual Background section text only
(Step 11), exactly as it goes into the Statement of Claim, citations
already hyperlinked per Step 12. Nothing from Channel 2 belongs in this
text - no flags, no tables, no logs, no dispositions, no gap report.

**Channel 2 - Working Notes, as a complete HTML page.** Take a copy of
references/working-notes-template.html and populate it - do not design a
page from scratch, and do not modify the template's CSS or `<script>`
block. The template is a fixed shell with nine tab panels, each carrying
an `<!-- INJECT: ... -->` comment marking exactly what to replace with
real content:

| Injection point | Replace with |
|---|---|
| `document_index_table` | One `<table>` row per Step 3 entry: Doc ID, Title, Date, Parties, and the source as a real `<a href="...">` link using that row's Source URL. |
| `fact_table_summary` | The Step 5 introductory paragraph. |
| `fact_table` | One row per Step 5 fact: #, Fact title, Fact, Source. |
| `relevance_assessment_table` | One row per document: the Step 4 Yes/No scores across all 10 parameters, plus the overall relevant/not-relevant result. |
| `contradiction_log` | One block per Step 6 entry: Proposition A/Source A, Proposition B/Source B, a `<span class="badge {{classification}}">` using one of the seven labels in references/contradiction-detection-protocol.md Section 5 (as a lowercase, underscore-separated class, e.g. direct_contradiction), Explanation, Confidence, Additional evidence needed. |
| `adverse_fact_log` | One block per Step 7 entry: Target proposition, Adverse fact, Source, How it weakens the narrative, Opponent's strongest use, Available explanation, a `<span class="badge {{classification}}">` using one of the eight labels in references/adverse-fact-detection-protocol.md Section 8, Recommended treatment (one of the six options in that protocol's Section 9), Confidence, Additional evidence needed. |
| `exhibit_map_table` | Step 10's Doc ID -> exhibit reference -> description mapping, source linked the same way as the Document Index. |
| `sub_header_map_table` | Step 10's letter -> title -> Legal Theory Brief element mapping. |
| `excluded_facts_table`, `contradiction_dispositions_table`, `adverse_fact_dispositions_table` | The three disposition tables from Step 13. |
| `end_notes_table` | Every flag from Step 3 onward (e.g. DATE UNCERTAIN, unresolved source_url), collected in one place. |
| `gap_report_table` | Anything unresolved from Step 14's verification sweep. |

Also replace `{{MATTER_NAME}}`, `{{GENERATED_TIMESTAMP}}`, and each
`{{..._COUNT}}` badge in the tab navigation with the real matter name,
generation time, and row counts for that tab.

**CRITICAL:** If any injection point has nothing to show (e.g. no
contradictions found), replace it with the template's own empty-state
placeholder text - never delete the section or leave the raw
`<!-- INJECT -->` comment in the output. Never add new tabs, remove
existing ones, or edit the template's structure, styling, or script -
consistency across every run of this skill (and across the rest of the
skill library, as more skills adopt this template) depends on the shell
staying fixed and only the content changing.

The result is one complete, self-contained HTML document (no external
network requests, no CDN dependencies - everything the page needs is
already inline in the template). This skill's job stops at producing
that file correctly. Hosting it and generating the URL referenced in
Step 16 are platform functions, not something this skill does directly.

### Step 16 - Present the Output

Return Channel 1 inline as the answer. Follow it with a single link,
clearly labeled (e.g. "View full working notes and analysis ->"),
pointing to the hosted Channel 2 page. Do not paste Channel 2's tables or
logs into the same response as the clean draft, even in summarized form
- if the lawyer wants to see specific working notes inline, that's a
separate, explicit follow-up request, not default behavior.

---

## Part 2: Checklist

Run these six checks before treating the record as final. They catch
things that a document-by-document review can miss because it never
steps back and looks at the case as a whole.

1. Industry & contract-type check. What industry does this matter sit
   in? Confirm the standard contract types for that industry have
   actually been requested and reviewed (see Part 3 - Domain Knowledge).
2. "Does this add up" check. Does the record show the other side raising
   a legitimate-looking defense or response that the client's own
   documents never actually answer? Flag it.
3. Chronology gap check. Is there an inconsistent sequence of events
   traceable to a missing document or an evidentiary gap? Flag it rather
   than smoothing over it.
4. Addendum & variation check. Did the parties execute any addendum or
   amendment to the contract? An addendum can vary or supersede rights
   and obligations under the original contract - confirm whether it did,
   and whether that affects the chronology or the claim.
5. Sanity check. Does anything in the record look fabricated, staged, or
   otherwise not hold together? This is a gut check, not a formal test -
   flag what doesn't sit right rather than rationalizing it away.
6. Language check. Does the language in the tables and explanations read
   clearly and simply? A lawyer reading the working notes shouldn't have
   to guess what something means.

---

## Part 3: Domain Knowledge

Domain knowledge is indexed by matter type in
references/domain-knowledge.md. Consult the entry matching this matter's
industry before finalizing Steps 4-9 - it tells you which documents to
expect and which industry-specific traps to check for.

Currently covered: a general contract-formation rule that applies
regardless of industry, renewable energy (EPC/FIDIC contracts and
project-calendar documents), joint ventures (milestone mapping), and
software development (evidence-decay risk).

**If this matter's industry isn't yet covered in the reference file, say
so explicitly rather than guessing at industry norms** - flag the gap for
the lawyer instead of improvising domain expertise the skill doesn't
actually have.

---

## Reference Files

- references/contradiction-detection-protocol.md - full sub-process for
  Step 6.
- references/adverse-fact-detection-protocol.md - full sub-process for
  Step 7.
- references/domain-knowledge.md - industry-indexed domain knowledge for
  Part 3 and Step 4's industry & contract-type check.
- references/headings.md - heading-drafting guidance for Step 11; read
  the scope note at the top before applying it here, since most of the
  file is written for legal-argument headings, not Factual Background's
  neutral sub-headers.
- references/paragraphs.md - paragraph-opening and drafting guidance for
  Step 11; same caveat - read the scope note before applying it here.
- references/working-notes-template.html - fixed HTML/CSS/JS shell for
  Channel 2, populated (not redesigned) in Step 15.

## Reference Calibration

The reference precedent's Section IV - seven lettered sub-sections
(A-G), each with several numbered paragraphs, every factual assertion
carrying a source citation, moving from contract formation through to
mitigation - is the target structure, density, and citation discipline
for Step 11.
