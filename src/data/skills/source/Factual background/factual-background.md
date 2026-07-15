---
name: factual-background
description: "Builds the fact record behind a Statement of Claim's Factual Background section from the underlying document corpus - a chronological document index, fact-by-fact extraction with pinpoint citations, a 10-parameter relevance test, systematic contradiction detection across documents, and adverse-fact identification - then drafts the numbered, exhibit-cited section itself. Use when a lawyer provides a Matter Setup Prompt and a document link (Drive, Dropbox, iManage) for a new matter, or asks to build a factual summary, statement of facts, chronology, sequence of events, or Factual Background section, or to check case documents for contradictions or adverse facts."
metadata:
  author: Suade
  version: "2.0"
  category: statement-of-claim
---

# Skill: Factual Background

Produces two things: the numbered, exhibit-cited Factual Background
section of the Statement of Claim, and the analytical record underneath
it — document index, fact-by-fact review, contradiction log, and
adverse-fact log — that later sections (Breach, Notice, Causation,
Quantum) will cite back into by paragraph number. The record matters as
much as the prose: an omission here is a hole a later legal section may
silently rely on without support.

**CRITICAL:** Never draft a paragraph directly from a read-through of the
documents. Build the Document Index and fact-by-fact review first (Steps
2–3) and draft only from that record (Step 10). If a sentence can't be
traced to a specific document and pinpoint citation, it doesn't go in the
draft.

This skill has three parts: **Steps** (the end-to-end process), a
**Checklist** (quality-control passes to run before finalizing), and
**Domain Knowledge** (industry-specific facts to check for, indexed in
`references/domain-knowledge.md`).

---

## Part 1: Steps

### Step 1 — Matter Intake

Read the Matter Setup Prompt. If there isn't one, ask the lawyer for a
few lines on what the case is about and what the client wants, and ask
whether they have a client meeting transcript or email to share —
these often surface facts and framing that formal documents don't.

### Step 2 — Document Collection

Using the Matter Setup Prompt to identify the matter, request the full
underlying document corpus — either uploaded files or a link to the
matter's Drive/Dropbox/iManage folder. Read every document before moving
to Step 3; don't sample.

### Step 3 — Build the Document Index

One row per document, sorted chronologically:

| Doc ID | Title | Date | Parties named | Pages |
|---|---|---|---|---|

**CRITICAL:** If a document is undated or the date is ambiguous (e.g. an
email chain with multiple timestamps), flag it explicitly rather than
guessing — `DATE UNCERTAIN — see note`.

### Step 4 — Extract and Cull Facts

Go through each document and pull out the important facts. One fact per
row, neutral phrasing (extract what the document says, not a persuasive
spin on it), with a pinpoint citation — page/paragraph/line/timestamp,
not just the document title. Extract facts that cut against the client's
position too; they get resolved in Step 6, not deleted here.

### Step 5 — Relevance Assessment (10-Parameter Test)

Assess each document's relevance from **both** the client's perspective
and the perspective of what works against the client's case. Score each
document Yes/No against:

1. **Event relevance** — does it establish that an event occurred?
2. **Temporal relevance** — does it establish when or in what sequence
   something happened?
3. **Actor relevance** — does it establish who knew, decided,
   communicated, or acted?
4. **Causal relevance** — does it help establish why something happened?
5. **Legal relevance** — does it bear on an element, defense, or
   applicable standard?
6. **Theory relevance** — does it support or weaken the party's theory
   of the case as framed in the Matter Setup Prompt?
7. **Corroboration relevance** — does it independently confirm an
   important event or assertion?
8. **Context relevance** — is it necessary to understand an otherwise
   ambiguous important event?
9. **Contradiction relevance** — does it contain or reveal a
   contradiction with another document? (Resolved in Step 6.)
10. **Adverse-fact relevance** — does it contain a fact that would be
    materially adverse if omitted? (Resolved in Step 7.)

### Step 6 — Contradiction Detection

Before concluding two documents conflict, run the full contradiction
protocol — **consult `references/contradiction-detection-protocol.md`
before doing this step**; it is not a formality, the protocol exists
specifically to stop superficial wording differences from being
misread as contradictions. In outline: isolate the specific factual
proposition being tested, extract each document's claim as a discrete
proposition, confirm the two claims are actually comparable (same actor,
event, time period, scope), apply the core test (*can both statements be
true at the same time, under the same interpretation of the facts?*),
and classify the relationship using the protocol's labels.

**CRITICAL:** Never resolve a contradiction yourself. Log it with both
sources and a confidence level, and let the lawyer decide.

### Step 7 — Adverse-Fact Detection

Before flagging a fact as adverse, run the full adverse-fact protocol —
**consult `references/adverse-fact-detection-protocol.md` before doing
this step**. In outline: identify the proposition the draft is asking
the reader to accept, extract precisely what the adverse evidence
establishes (without overstating it), apply the omission test (*would a
reasonable reader form a materially different impression if this fact
were left out?*) and the opponent-use test (*how would opposing counsel
fairly use this against the draft?*), then classify and recommend a
treatment.

**CRITICAL:** Don't flag every unfavorable fact — only ones that
materially weaken an important proposition, support a plausible
competing explanation, undermine a relied-upon source, or would
materially mislead by omission. Over-flagging buries the real ones.

### Step 8 — Targeted Re-Review of Case-Critical Documents

Regardless of how Steps 5–7 scored them, specifically re-examine any
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

These documents anchor limitation analysis, breach timing, and quantum
in the sections that cite this one — a gap here propagates downstream.

### Step 9 — Exclude Irrelevant Documents

A document that scored No on all ten Step 5 parameters and produced no
contradiction (Step 6) or adverse fact (Step 7) is not relevant. Exclude
it and note the exclusion — don't just drop it silently from the record.

### Step 10 — Structure the Record

Two things, done together:

- **Exhibit Numbering Map** — a table of Doc ID → exhibit reference →
  document description. If no numbering scheme exists yet for this
  matter, propose one (typically chronological) and flag it as a
  proposal requiring confirmation, since every later section inherits it.
- **Sub-header architecture** — group the chronology into lettered
  episodes (A, B, C…) at natural breakpoints in the fact pattern (a new
  phase of the relationship, a discrete event, a shift in conduct), not
  forced into a fixed template. For each sub-header, note which element
  of the Legal Theory Brief it primarily supports.

### Step 11 — Draft the Section

Under each sub-header, numbered paragraphs in chronological order, drawn
only from the Step 4 fact review:

- Include every fact that survived Step 9 as relevant to that
  sub-header — this section earns its force through completeness, not
  compression.
- Pinpoint exhibit citation on every factual assertion (e.g. "(Exhibit
  C-4)"), using the Step 10 map.
- Sequential paragraph numbering, continuing the document's running
  count.
- Short declarative sentences; let facts carry the weight, no
  editorializing adjectives.
- **CRITICAL:** No legal characterization. State what happened; the
  conclusion that it constitutes breach, valid notice, etc. belongs to
  the sections that cite back to these paragraphs.
- Every date, figure, and defined term must match the Brief Summary of
  Facts narrative exactly. If this section surfaces a more precise
  figure than the Brief Summary used, flag the discrepancy for
  reconciliation rather than letting the two silently diverge.

### Step 12 — Log Dispositions

Nothing gets excluded or resolved silently. Log an explicit disposition
for:

- Every fact that survived Step 5 as Core or Contextual but doesn't
  appear in the draft — reason required.
- Every contradiction from Step 6 — both sources, classification,
  confidence level.
- Every adverse fact from Step 7 — one of: include here neutrally,
  address in a named later section (e.g. Causation), or exclude as
  immaterial (flagged for lawyer confirmation). Default to inclusion or
  deferral, not exclusion — a claimant who has visibly engaged with an
  adverse fact reads better to a tribunal than one whose narrative is
  silent on something the other side will raise anyway.

### Step 13 — Verification Sweep

- **Grounding check** — every paragraph traces to a specific fact and
  exhibit; nothing asserts more than its citation supports.
- **Completeness sweep** — every fact from Step 4 either appears in the
  draft or has a Step 12 disposition.
- **Consistency check** — diff dates, figures, and defined terms against
  the Brief Summary of Facts narrative.
- **Citability check** — paragraph numbers are sequential and every
  exhibit reference resolves against the Step 10 map.

### Step 14 — Output Package

Deliver together: the clean draft; the Document Index; the fact-by-fact
review table; the Exhibit Numbering Map; the Sub-Header-to-Legal-Element
Map; the Contradiction Log; the Adverse-Fact Log with dispositions; and a
Gap Report covering anything unresolved from Step 13.

---

## Part 2: Checklist

Run these five checks before treating the record as final. They catch
things a document-by-document review misses because it never steps back
and looks at the case as a whole.

1. **Industry & contract-type check.** What industry does this matter
   sit in? Confirm the standard contract types for that industry have
   actually been requested and reviewed (see Part 3 — Domain Knowledge).
2. **"Does this add up" check.** Does the record show the other side
   raising a legitimate-looking defence or response that the client's
   own documents never actually answer? Flag it.
3. **Chronology gap check.** Is there an inconsistent sequence of events
   traceable to a missing document or an evidentiary gap? Flag it rather
   than smoothing over it.
4. **Addendum & variation check.** Did the parties execute any
   addendum or amendment to the contract? An addendum can vary or
   supersede rights and obligations under the original contract —
   confirm whether it did, and whether that affects the chronology or
   the claim.
5. **Sanity check.** Does anything in the record look fabricated,
   staged, or otherwise not hold together? This is a gut check, not a
   formal test — flag what doesn't sit right rather than rationalizing
   it away.

---

## Part 3: Domain Knowledge

Domain knowledge is indexed by matter type in
`references/domain-knowledge.md`. Consult the entry matching this
matter's industry before finalizing Steps 4–9 — it tells you which
documents to expect and which industry-specific traps to check for.

Currently covered: a general contract-formation rule that applies
regardless of industry, renewable energy (EPC/FIDIC contracts and
project-calendar documents), joint ventures (milestone mapping), and
software development (evidence-decay risk).

**If this matter's industry isn't yet covered in the reference file,
say so explicitly rather than guessing at industry norms** — flag the
gap for the lawyer instead of improvising domain expertise the skill
doesn't actually have.

---

## Reference Files

- `references/contradiction-detection-protocol.md` — full sub-process
  for Step 6.
- `references/adverse-fact-detection-protocol.md` — full sub-process for
  Step 7.
- `references/domain-knowledge.md` — industry-indexed domain knowledge
  for Part 3 and Step 5.1 (industry & contract-type check).

## Reference Calibration

The reference precedent's Section IV — seven lettered sub-sections
(A–G), each with several numbered paragraphs, every factual assertion
carrying an exhibit citation, moving from contract formation through to
mitigation — is the target structure, density, and citation discipline
for Step 11.
