---
name: brief-summary-of-facts
description: >
  Use this skill to draft the "Brief Summary of Facts" content that opens
  Section I (Introduction and Summary) of a Statement of Claim in an
  arbitration. Trigger this skill whenever the lawyer supplies (a) an initial
  case brief / problem statement describing why the client is bringing the
  claim, and (b) a volume of underlying documents (contracts, correspondence,
  emails, reports, invoices, notices, minutes, technical reports, etc.) and
  asks for a chronology, timeline, fact summary, or narrative statement of
  facts to be built from them. This skill must ALWAYS be used instead of
  drafting a chronology from a single pass over the documents — it enforces a
  document-indexing and dual-verification process designed to prevent
  hallucinated facts and prevent omission of material facts.
---

# Skill: Brief Summary of Facts (Persuasive Chronology)

## 1. Purpose

Produce the persuasive, chronologically-ordered narrative of facts that
opens a Statement of Claim (modelled on Section I.2 of the reference
precedent — the "This is a [type] dispute... X did Y, Z happened, Claimant
now claims..." paragraph), grounded **exclusively** in the documents the
client has provided, and checked against two independent failure modes:

- **Fabrication** — asserting a fact, date, or characterization not
  supported by any source document.
- **Omission** — leaving out a fact that is material to the claim theory,
  even though it exists somewhere in the document set.

This skill treats those two failure modes as equally serious. A chronology
that is accurate but incomplete is as dangerous to the lawyer as one that is
complete but invents things — both damage credibility with the Tribunal and
create risk on cross-examination or document production.

## 2. Required Inputs

Do not begin drafting until both of the following are available. If either
is missing, ask for it before proceeding — do not guess at the claim theory.

1. **The Initial Instruction Prompt ("Case Brief")** — the lawyer's own
   framing of the dispute: who the client is, who the counterparty is, what
   went wrong, and why the client is bringing a claim. This is the
   *relevance lens*. It is not itself a source of fact — it is used only to
   identify which documentary facts matter and to keep the chronology on
   theory. Facts must never be manufactured to fit this brief.
2. **The Document Corpus** — the full set of client-provided materials:
   contracts and annexes, correspondence (letters and emails), technical
   reports, inspection/test data, meeting minutes, invoices, internal memos,
   notices, witness accounts, etc. Treat this as closed-universe: the
   chronology may only contain what is in this corpus (or in the Case
   Brief, clearly flagged as instruction rather than documentary fact).

## 3. Non-Negotiable Rule: Citation-First Extraction

**Never draft narrative prose directly from a read-through of the
documents.** Always build an intermediate, citable Fact Table first, and
draft only from that table. This is the single mechanism that prevents
hallucination downstream — if a sentence in the final narrative cannot be
traced to a row in the Fact Table, it cannot survive Phase 4 (Verification).

## 4. Process

### Phase 0 — Document Indexing

For every document in the corpus, create one row in a **Document Index**:

| Doc ID | Date | Type | Author → Recipient | Title/Subject | 1-line description |
|---|---|---|---|---|---|

- Assign a stable Doc ID (e.g. `D-001`, `D-002`) in the order documents were
  provided — do **not** renumber later; downstream exhibit numbering will
  map to these IDs.
- If a document is undated or the date is ambiguous (e.g. an email chain
  with multiple timestamps), flag it explicitly: `DATE UNCERTAIN — see note`.
  Do not assign a best-guess date silently.
- Sort a working copy of the index chronologically once dates are settled.
  Where two documents share a date, order by logical sequence (e.g. an
  email before its reply) and note the tie-break basis.

### Phase 1 — Atomic Fact Extraction

Go through the corpus **document by document** (not narrative-first) and
extract atomic facts into a **Fact Table**:

| Fact ID | Date | Fact (one sentence, neutral phrasing) | Source (Doc ID + pinpoint: page/¶/line/email timestamp) | Category |

Rules for this phase:

- **One fact per row.** Do not compound two facts into one row — compound
  rows are where omissions hide during later filtering.
- **Neutral phrasing at this stage.** Extract *what the document says*, not
  a persuasive characterization of it. Persuasive framing happens later, in
  Phase 3, and only on top of facts already anchored here.
- **Pinpoint citations are mandatory.** "Per the Supply Agreement" is not
  sufficient; cite the clause. "Per the BTIA Report" is not sufficient; cite
  the page/paragraph and, where relevant, quote the operative finding (in
  your own words per citation practice — do not lift verbatim text beyond
  short defined terms).
- **Extract facts that cut against the client's position too.** If a
  document records something unfavourable (e.g. an internal email
  acknowledging a possible cause other than the counterparty's breach), it
  still goes in the Fact Table, tagged `Category: Adverse/Needs Review`. It
  is the lawyer's decision, not the model's, whether and how to address it
  — silently dropping it is exactly the omission risk this skill exists to
  prevent.
- **Category tags** (assign one or more per fact): `Contractual Term`,
  `Performance/Conduct`, `Defect/Failure Event`, `Notice/Correspondence`,
  `Damage/Loss`, `Adverse/Needs Review`, `Background/Context`.
- If two documents conflict on a fact (e.g. different figures for the same
  metric), extract **both**, cite both, and flag: `CONFLICT — see Fact
  IDs X/Y`. Never silently pick one.

### Phase 2 — Relevance Filtering Against the Case Brief

Using the Initial Instruction Prompt as the relevance lens, tag every row
in the Fact Table:

- `Core` — directly supports or is necessary context for the claim theory
  as framed in the Case Brief.
- `Contextual` — background that helps the narrative read coherently but
  isn't itself doing persuasive work.
- `Park` — not obviously relevant to this section, but potentially
  relevant to other sections of the Statement of Claim (breach, causation,
  quantum, etc.) or to anticipated defences.

**Do not delete `Park` rows.** They stay in the Fact Table and are handed
back to the lawyer as an appendix (see Phase 5 output). Deleting facts that
seem immaterial to *this* section is a common source of the omission
problem the practitioner note flagged — a fact irrelevant to the summary
may be critical to breach, causation, or a limitation defence later.

### Phase 3 — Chronology Assembly

Merge the `Core` and `Contextual` facts into a single chronological
sequence. This is the working chronology — still citation-tagged, not yet
prose. At this stage, group related facts under natural sub-events (e.g.
"contract formation," "first sign of defect," "notice exchange,"
"termination") the way the reference precedent uses lettered sub-headers
(A. The Supply Agreement, B. The Specification..., C. Deliveries...).

### Phase 4 — Persuasive Narrative Drafting

Draft the actual "Brief Summary of Facts" prose from the Phase 3 chronology
only. Style rules:

- **Persuasive through selection and sequencing, not through adjectives.**
  The precedent's tone ("They were not," "Castor refused to remedy the
  position") gets its force from short declarative sentences and factual
  sequencing, not from adverbs or characterization. Favour that register.
- **Every sentence must map to one or more Fact IDs.** Keep an invisible
  citation keyed to each sentence during drafting (e.g. as a bracketed tag
  `[F-014]`) — these are stripped in the final clean version but retained
  in the working/annotated version for the verification phase and for the
  lawyer's review.
- **State conclusions the documents actually support; do not argue legal
  characterizations that belong in later sections.** E.g. it is fine to say
  the modules failed at a stated rate against a stated contractual cap
  (fact); it is not this skill's job to conclude that this constitutes a
  breach of § 434 BGB (that is legal argument for Section V).
- **Keep to a summary register.** This is the *brief* summary — aim for
  the length and density of the precedent's paragraph 2, not a full
  chronology recitation. The full chronology remains available as a
  supporting deliverable (Phase 5) for the lawyer to mine for the detailed
  Factual Background section.
- Use the parties' defined terms exactly as fixed in the Case Brief /
  documents (e.g. "the Modules," "the Affected Batches") once first
  introduced.

### Phase 5 — Verification (Anti-Hallucination / Anti-Omission Pass)

Run this as two distinct checks. Do not merge them — they catch different
failure modes and collapsing them tends to catch neither well.

**(a) Grounding check (anti-fabrication).** Go through the drafted
narrative sentence by sentence. For each sentence, confirm the `[F-xxx]`
tag(s) exist in the Fact Table and that the sentence does not say more than
the cited fact(s) support (watch for smuggled-in intensifiers, implied
causation not in the source, or dates/figures that drifted during drafting).
Anything that fails is either cut, softened to what the fact supports, or
flagged to the lawyer as an inference requiring instruction.

**(b) Completeness check (anti-omission).** Independently of the drafted
narrative, re-read the Document Index and Fact Table against the Case
Brief's claim theory and ask: *is there a `Core`-relevant fact that exists
in the corpus but does not appear anywhere in the narrative?* This check
should be run as if reviewing someone else's draft — actively look for
gaps rather than confirming what's already there. Produce a short **Gap
Report** listing any such facts and why they were left out (e.g.
"deliberately excluded as adverse — flagged for lawyer," "excluded as
duplicative of F-009," "should be added — currently missing").

### Phase 6 — Output Package

Always deliver all four items together, not just the clean narrative:

1. **Clean narrative** — the citation-free Brief Summary of Facts, ready to
   sit in Section I of the Statement of Claim.
2. **Annotated narrative** — same text with `[F-xxx]` citation tags intact,
   for the lawyer's review.
3. **Document Index + Fact Table** — the full working data, including
   `Park` and `Adverse/Needs Review` rows.
4. **Gap Report** — output of the Phase 5(b) completeness check, plus any
   unresolved `CONFLICT` or `DATE UNCERTAIN` flags from Phases 0–1.

## 5. Guardrails

- If a fact needed to complete the story is simply not in the corpus, say
  so in the Gap Report ("not established by the documents provided") —
  never fill the gap with a plausible-sounding inference.
- Never resolve a factual conflict between documents on your own authority;
  surface it.
- Never drop an adverse fact to make the narrative read better; tag it and
  surface it instead.
- Do not let the Case Brief's framing override what the documents actually
  say — the Case Brief sets relevance, not content.
- Legal characterization (breach, causation, defect classification) stays
  out of this section's output — flag where it *would* attach, for the
  lawyer to carry into the substantive sections, but do not draft the legal
  argument here.

## 6. Reference Calibration

The reference Statement of Claim's Section I.2 is the target register for
the clean narrative — a five-to-eight sentence, fact-dense, chronologically
ordered paragraph that a Tribunal member could read cold and understand the
whole dispute. Use it to calibrate length and tone, not content.
