---
name: evidence-relied-upon
description: >
  Use this skill to draft the Evidence Relied Upon section of a Statement
  of Claim, and to produce the underlying evidentiary-strength analysis
  behind it — cataloguing witness statements, documentary exhibits, and
  expert reports, and assessing each item's evidentiary value (probative
  weight, corroboration, vulnerabilities) under the arbitration's actual
  evidentiary framework. Trigger this skill whenever the lawyer asks to
  draft the evidence section, catalogue evidence, assess evidentiary
  weight or admissibility, or check whether every pleaded fact is actually
  backed by evidence in the record. This skill must always be used instead
  of a simple evidence list — it separates the compact pleaded text (which
  stays lean, per standard practice) from the fuller evidentiary-value
  working analysis, and never asserts an evidentiary rule (e.g. an IBA
  Rules provision) without confirming it actually applies to this
  arbitration.
---

# Skill: Evidence Relied Upon

## 1. Purpose

Produce two distinct things, not one: (1) the compact Evidence Relied Upon
section as it will appear in the filed Statement of Claim — a short list
of witness statements and exhibits, in the register of the reference
precedent — and (2) the underlying working analysis of each item's
evidentiary value under the arbitration's actual evidentiary framework,
including its probative weight, its vulnerabilities, and whether every
pleaded fact is actually backed by something in the evidentiary record.
The second is strategic working material for the lawyer, not itself
pleading text, unless the lawyer specifically wants weight arguments made
expressly in the filed section.

## 2. Required Inputs

1. **Document Index and Fact Table** (Brief Summary of Facts skill), which
   already ties documentary evidence to specific facts — reuse this
   linkage rather than re-deriving it.
2. **Factual Background section** (numbered paragraphs), to map each
   evidence item to the specific pleaded facts it supports.
3. **Witness statements** (draft or final), with the witness's role and
   the scope of what they personally observed.
4. **Expert reports**, existing or anticipated, with the expert's stated
   qualifications and independence basis.
5. **Jurisdiction and Applicable Law section output**, for the
   institutional rules' evidentiary provisions, and confirmation of
   whether any additional evidentiary guidelines (e.g. the IBA Rules on
   the Taking of Evidence in International Arbitration) have actually been
   adopted for this arbitration — by the clause, a procedural order, or
   party agreement. **Do not assume such guidelines apply by default**,
   even though they are common in international arbitration practice.
6. **Exhibit Numbering Map** (Factual Background skill), reused, not
   recreated.

## 3. Non-Negotiable Rules

- **No invented evidentiary rule or admissibility standard.** Any
  statement about what is or isn't admissible, or how weight is assessed,
  must be sourced to the institutional rules, a confirmed set of adopted
  evidentiary guidelines, or supplied commentary — not to a general sense
  of "how arbitration evidence usually works."
- **No assuming adoption of external evidentiary guidelines.** If the IBA
  Rules or an equivalent framework are commonly used in this type of
  arbitration but their adoption in this specific matter isn't confirmed,
  flag it — don't apply their provisions as if agreed.
- **No privilege determinations.** This skill flags items that might be
  privileged or sensitive; it never decides whether privilege applies,
  has been waived, or whether an item should be excluded. That is the
  lawyer's judgment call.

## 4. Process

### Phase 0 — Build the Evidence Register

One row per item relied upon or anticipated:

| Evidence ID | Type (witness statement / documentary exhibit / expert report) | Author/source | Description | Exhibit reference | Linked Fact ID(s) / Factual Background ¶ | Linked SoC section(s) relying on it |

For witness statements: capture the witness's role, and specifically flag
which parts of their evidence are firsthand observation versus secondhand
or reconstructed — this distinction matters for the weight assessment in
Phase 2. For expert reports: capture the expert's stated qualifications,
independence basis, scope of opinion, and whether already served or
anticipated per the procedural timetable (flag anticipated evidence
explicitly, as the reference precedent does).

### Phase 1 — Determine the Applicable Evidentiary Framework

Using the Jurisdiction and Applicable Law skill's output, confirm what
actually governs evidence in this arbitration: the institutional rules'
own evidentiary provisions, and — only if confirmed adopted, not assumed —
any additional evidentiary guidelines. Extract the relevant principles
into an **Evidentiary Standards Checklist**:

| Principle | Source (rules provision / adopted guideline / commentary) | Application note |

Typical principles to check for (only if actually sourced for this
arbitration, not asserted generically): the tribunal's discretion on
admissibility versus weight, the status of witness statements as written
testimony subject to cross-examination, any presumption of authenticity
for undisputed documents, expert independence requirements, and any
recognized privilege protections.

### Phase 2 — Evidentiary Value Assessment (Working Analysis)

For each item in the Evidence Register, assess — grounded in Phase 1's
sourced principles, not general intuition:

| Evidence ID | Probative weight factors | Vulnerabilities | Corroboration (other items supporting the same fact) | Flags |

- **Probative weight factors**: e.g. whether the item is a contemporaneous
  document versus a later recollection — only state that contemporaneous
  documents carry more weight if that principle is actually sourced for
  this framework, not asserted as generic common sense.
- **Vulnerabilities**: hearsay/secondhand content, the witness's potential
  interest or bias (e.g. a current employee of the claimant), authenticity
  or completeness concerns, translation issues if the document isn't in
  the arbitration's designated language.
- **Corroboration**: cross-reference other Evidence Register entries
  supporting the same fact — a fact resting on one uncorroborated,
  interested witness is materially weaker than one supported by
  contemporaneous documents plus witness testimony.
- **Expert-specific flag**: note if any part of an expert's stated opinion
  strays into legal conclusions rather than technical/factual opinion —
  tribunals often discount opinion evidence that oversteps into legal
  argument.

This table is working analysis for the lawyer's strategic use — it is not
by default part of the filed pleading text (see Phase 5).

### Phase 3 — Privilege and Sensitivity Screening (Flag Only)

Screen the Evidence Register for any item that might be subject to legal
advice privilege, litigation privilege, or without-prejudice protection,
or that is otherwise sensitive. List candidates. **This phase flags for
the lawyer's own review — it does not decide inclusion, exclusion, or
waiver.**

### Phase 4 — Evidence-to-Pleading Cross-Reference Check

Run in both directions:

1. **Forward**: for every fact tagged `Core` in the Fact Table and every
   numbered paragraph in the Factual Background section, confirm at least
   one Evidence Register entry supports it. A `Core` fact with no
   evidentiary backing in the current record is a gap — flag it, since it
   means a pleaded fact currently rests on nothing citable.
2. **Reverse**: confirm every Evidence Register entry is actually relied
   upon somewhere in the pleaded facts or legal sections. An item with no
   pleaded use is flagged — unused evidence in the record can raise
   proportionality or cost concerns under some institutional rules, and at
   minimum doesn't belong in the filed list.

### Phase 5 — Draft the Section

**Filed pleading text** — compact, calibrated to the reference precedent:
a short list of witness statements (name, role, one-line scope) and the
exhibit range relied upon, with a note reserving the right to serve
anticipated expert evidence per the procedural timetable. Do not import
the Phase 2 weight analysis into this text by default — the filed section
in this style is a list, not an argument.

**If the lawyer specifically wants evidentiary weight addressed in the
filed text** (a legitimate style choice in some practices or for specific
strategic reasons), extend the draft to include it, but keep the same
sourcing discipline — any weight statement made in the filed text still
needs its Phase 1/2 basis.

### Phase 6 — Verification

**(a) Grounding check.** Every description and weight assessment traces to
a sourced principle (Phase 1) and a specific Evidence Register entry.

**(b) Evidentiary-framework sourcing check.** Confirm any external
guideline (e.g. IBA Rules) applied was actually confirmed adopted for this
arbitration, not assumed.

**(c) Bidirectional coverage check.** Confirm the Phase 4 forward and
reverse checks were both run and any gaps logged.

**(d) Privilege flag check.** Confirm Phase 3 candidates were surfaced,
not silently resolved.

**(e) Exhibit consistency check.** Confirm every exhibit reference
resolves against the existing Exhibit Numbering Map — no renumbering.

### Phase 7 — Output Package

1. **Clean draft** — the filed Evidence Relied Upon section.
2. **Evidence Register** — full working table with fact/section linkages.
3. **Evidentiary Standards Checklist** (Phase 1).
4. **Evidentiary Value Assessment** (Phase 2) — the working analysis.
5. **Privilege/Sensitivity Flags** (Phase 3).
6. **Coverage Gap Report** — unevidenced pleaded facts and unused evidence
   items (Phase 4).

## 5. Guardrails

- Never state an admissibility or weight principle without a sourced
  basis specific to this arbitration's actual evidentiary framework.
- Never assume adoption of external evidentiary guidelines without
  confirmation.
- Never decide a privilege question — flag it.
- Keep the filed pleading text in the compact register of the reference
  precedent unless the lawyer specifically asks for weight argument to be
  made expressly in the section.
- Never renumber exhibits outside the existing Exhibit Numbering Map.

## 6. Reference Calibration

The reference precedent's Section XII — a short list of named witness
statements with role, the exhibit range with a few singled out by
significance, and a reservation of the right to serve expert evidence per
the procedural timetable — is the target format and length for the filed
text.
