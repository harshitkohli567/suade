---
name: factual-background
description: >
  Use this skill to draft Section IV (Factual Background) of a Statement of
  Claim — the full, numbered-paragraph, sub-headed chronology of events
  built from the client's documents, correspondence, and emails. Trigger
  this skill whenever the lawyer asks for the "Factual Background,"
  "statement of facts," "full chronology," or "sequence of events" section
  of a Statement of Claim (as distinct from the short "Brief Summary of
  Facts" used in the Introduction). This skill must always be used instead
  of drafting this section freehand — it is the authoritative factual
  record that every later legal section (Breach, Notice, Causation,
  Quantum) will cite back to by paragraph number, so completeness and
  pinpoint sourcing matter more here than in any other section.
---

# Skill: Factual Background

## 1. Purpose

Produce the full, numbered, sub-headed chronology of events that forms
Section IV of the Statement of Claim — the detailed factual foundation
that the legal argument sections (Breach, Notice/Inspection, Causation,
Liability Cap, Quantum) will each rely on and cite back into by paragraph
number (e.g. "as set out at ¶15 above"). This is not a condensed summary —
it is the comprehensive, exhibit-referenced factual record.

Because later sections cite into this one, two properties matter more here
than anywhere else in the document: **every material fact must actually
be present** (an omission here isn't just a narrative gap, it's a hole a
later legal section may silently rely on without support), and **paragraph
numbering and exhibit references must be stable and precise**, since they
become load-bearing cross-references throughout the rest of the document.

## 2. Prerequisite

This skill assumes the **Document Index** and **Fact Table** already exist
from the Brief Summary of Facts skill. If they don't exist yet for this
matter, run Phases 0–1 of that skill first — do not re-derive them from
scratch with different methodology, or the two sections will drift apart
on dates, figures, and defined terms.

## 3. Required Inputs

1. **Document Index and Fact Table** (from Brief Summary of Facts skill),
   including `Park` and `Adverse/Needs Review` rows — this skill uses the
   full table, not just the `Core`-tagged rows.
2. **The Brief Summary of Facts clean narrative**, for consistency
   checking — figures, dates, and defined terms must match exactly.
3. **The Legal Theory Brief**, so the sub-header architecture and level of
   factual detail track what the substantive sections will need to cite.
4. **Exhibit numbering convention**, if already fixed for the matter (e.g.
   "C-1, C-2..."). If not yet fixed, this skill proposes one (Phase 2) —
   flagged clearly as a proposal, since exhibit numbers become
   cross-referenced throughout the whole Statement of Claim once set.

## 4. Non-Negotiable Rules

- **Citation-first, same as Brief Summary of Facts.** Draft only from Fact
  Table rows, each carrying a pinpoint source citation. Never draft a
  paragraph directly from a read-through of the documents.
- **No invented exhibit numbers.** Exhibit references must come from the
  Exhibit Numbering Map (Phase 2), not be assigned ad hoc while drafting.
- **No silent exclusion of `Core`-tagged facts.** Every fact tagged `Core`
  or `Contextual` in the Fact Table must appear somewhere in the drafted
  section, or be explicitly logged as a deliberate exclusion with a reason
  in the output (see Phase 4). Unlike the Brief Summary skill, brevity is
  not a justification for leaving a `Core` fact out here.

## 5. Process

### Phase 0 — Confirm Fact Table Currency

Before drafting, confirm the Fact Table reflects the full current document
corpus (check whether any documents have been added since the Brief
Summary of Facts skill was last run). If new documents exist, run Phase 1
of that skill (atomic fact extraction) on them now, adding to the existing
table rather than starting a parallel one.

### Phase 1 — Sub-Header Architecture

Group the chronology into logical narrative episodes — not strict date
order across the whole section, but chronological *within* each episode.
The reference precedent's shape (contract formation → specification/
warranties → deliveries and emergence of the defect → a discrete incident
→ independent investigation → notice/cure/termination → mitigation) is one
common pattern for a contract/product-defect dispute, but the actual
grouping should follow the shape of this matter's fact pattern, not be
forced into that template. Derive sub-headers from natural breakpoints in
the Fact Table (a new phase of the relationship, a discrete event, a shift
in the parties' conduct), and letter them (A, B, C...) under the section's
Roman numeral.

For each proposed sub-header, note which Legal Theory Brief element(s) it
will primarily support — this is what lets later sections cite back
precisely instead of vaguely.

### Phase 2 — Exhibit Numbering Map

Build or confirm a table mapping each Doc ID to its exhibit reference:

| Doc ID | Exhibit reference | Document description |

If this is the first skill in the matter to need exhibit numbers, propose
a numbering scheme (typically chronological or by category) and flag it
as a proposal requiring confirmation, since every subsequent section will
inherit it. If a scheme already exists, use it as-is and flag any Doc ID
not yet covered by it.

### Phase 3 — Draft the Section

Under each sub-header, draft numbered paragraphs from the relevant Fact
Table rows, in chronological order within the sub-header:

- **Comprehensiveness over compression.** Include every `Core` and
  `Contextual` fact relevant to that sub-header — this section earns its
  persuasive force through a complete, well-organized record, not through
  selective brevity (that's the Brief Summary skill's job).
- **Pinpoint exhibit citation on every factual assertion**, using the
  Phase 2 map (e.g. "(Exhibit C-4)").
- **Sequential paragraph numbering** continuing the document's running
  paragraph count (coordinate with whatever section precedes this one so
  numbers don't collide or restart).
- **Persuasive through structure and selection, not adjectives** — same
  style discipline as the Brief Summary skill: short declarative
  sentences, facts allowed to speak for themselves, no editorializing
  adjectives layered on top of what the documents support.
- **Consistency with the Brief Summary of Facts narrative** — every date,
  figure, and defined term used here must match that narrative exactly.
  If this section reveals a fact that changes a figure used in the Brief
  Summary (e.g. a more precise date or amount emerges from a document
  processed after the Brief Summary was drafted), flag the discrepancy
  for reconciliation rather than letting the two sections silently diverge.
- **Legal characterization stays out.** State what happened; leave the
  conclusion that it constitutes breach, non-conforming performance, valid
  notice, etc. to the sections that argue those points and will cite back
  to these paragraphs.

### Phase 4 — Adverse Fact Disposition

For every Fact Table row tagged `Adverse/Needs Review`, make an explicit,
logged disposition — never a silent one:

| Fact ID | Adverse fact | Disposition | Reason |

Disposition options: `Include here neutrally`, `Address in [named later
section, e.g. Causation]`, `Exclude — immaterial (flag for lawyer
confirmation)`. This decision should default to inclusion or explicit
deferral to a rebuttal section, not exclusion — arbitration tribunals
generally respond better to a claimant who has visibly engaged with an
adverse fact than one whose narrative is silent on something the other
side will raise. Where the skill is not confident which disposition is
right, flag it for the lawyer rather than choosing.

### Phase 5 — Verification

**(a) Grounding check.** Every paragraph traces to specific Fact ID(s) and
exhibit reference(s); no paragraph asserts more than its cited facts
support.

**(b) Completeness check — full Fact Table sweep.** Unlike the Brief
Summary skill's completeness check (which looks for `Core` gaps only),
this check sweeps the **entire** Fact Table — `Core`, `Contextual`, and
`Park` rows — and confirms each either appears in the drafted section or
has a logged reason for exclusion (e.g. "reserved for Quantum section,"
"reserved for Causation section," per Phase 4 for adverse facts). A
`Park` fact reserved for a later section is a valid disposition; a `Core`
or `Contextual` fact with no disposition at all is not.

**(c) Cross-document consistency with Brief Summary of Facts.** Diff
dates, figures, and defined terms between this section and the Brief
Summary narrative; flag any mismatch.

**(d) Citability check.** Confirm paragraph numbers are sequential and
exhibit references resolve to the Phase 2 map — later skills (Breach,
Causation, etc.) will depend on both being stable.

### Phase 6 — Output Package

1. **Clean draft** — the full Section IV, with sub-headers and numbered
   paragraphs.
2. **Exhibit Numbering Map** — for reuse by all subsequent sections.
3. **Sub-Header-to-Legal-Element Map** — from Phase 1, so later skills know
   which paragraphs to cite for which legal point.
4. **Adverse Fact Disposition table** — from Phase 4.
5. **Gap Report** — the full-sweep completeness check from Phase 5(b), plus
   any Brief Summary consistency flags from Phase 5(c).

## 6. Guardrails

- Never leave a `Core` or `Contextual` fact out of the section without a
  logged, explicit reason.
- Never invent or renumber exhibit references outside the Exhibit
  Numbering Map.
- Never let this section's figures/dates diverge from the Brief Summary of
  Facts narrative without flagging the discrepancy.
- Never resolve an adverse fact's disposition silently — log the decision
  and the reason.
- Keep legal characterization out — this section builds the record,
  later sections argue from it.

## 7. Reference Calibration

The reference precedent's Section IV — seven lettered sub-sections (A–G),
each with several numbered paragraphs, every factual assertion carrying an
exhibit citation, moving from contract formation through to mitigation —
is the target structure, density, and citation discipline.
