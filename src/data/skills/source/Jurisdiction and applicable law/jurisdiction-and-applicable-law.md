---
name: jurisdiction-and-applicable-law
description: >
  Use this skill to draft Section III (Jurisdiction and Applicable Law) of
  a Statement of Claim in an arbitration — identifying the Tribunal's
  jurisdictional basis (the arbitration clause: institution, seat,
  language, rules), confirming which edition of the institutional rules
  actually governs, and stating the applicable substantive law. Trigger
  this skill whenever the lawyer asks to draft the jurisdiction/applicable
  law section, to "read the contract and confirm the arbitration clause,"
  to confirm which arbitration rules apply, or to check the governing law
  of a dispute. This skill must always be used instead of drafting this
  section from memory of institutional rules — rules editions change over
  time, and the applicable edition must be verified against the
  institution's current rules text and transitional provisions, not
  recalled from training data.
---

# Skill: Jurisdiction and Applicable Law

## 1. Purpose

Produce the Jurisdiction and Applicable Law section by (a) extracting the
actual arbitration clause from the contract, (b) determining — with
external verification, not recall — which edition of the named
institution's rules governs this specific arbitration, and (c) stating the
applicable substantive law as expressly chosen (or flagging that it needs
counsel's conflict-of-laws analysis if it isn't).

This section reads as a short, confident paragraph in the final Statement
of Claim, but two things sit underneath it that are easy to get wrong
silently: which rules edition actually applies (institutions revise their
rules periodically, and clauses are often silent on edition), and whether
jurisdiction is genuinely uncontested (asserting it is when the record
shows otherwise is a drafting error, not a stylistic choice).

## 2. Required Inputs

1. **The contract containing the arbitration clause** (and any amendment,
   novation, or accession agreement affecting it).
2. **Output of the Brief Summary of Facts skill** (Fact Table), to check
   whether the Respondent has taken any position on jurisdiction, scope,
   or seat in correspondence.
3. **The Legal Theory Brief**, to confirm the scope of claims being
   pleaded, so the clause's scope language can be checked against them.
4. **Web/document search access to the named institution's current rules**
   — this skill cannot be completed reliably from memory alone (see Phase
   1).

## 3. Non-Negotiable Rules

- **No invented clause language.** Extract the arbitration clause's actual
  wording from the contract. Do not paraphrase from a "typical" clause of
  that institution.
- **No recall-only rules determination.** Which edition of an
  institution's rules governs, and what that edition's substantive
  content says (number of arbitrators default, expedited procedure
  thresholds, cost provisions, emergency arbitrator provisions, etc.),
  must be confirmed against the institution's current official rules text
  and any transitional/applicability provision — not answered from
  training-data memory. Institutional rules are revised periodically;
  treat any recalled rules content as a hypothesis to verify, not an
  answer to state.
- **No silent assertion of uncontested jurisdiction.** "The Respondent has
  not contested jurisdiction" (or the reverse) is a factual claim like any
  other — it must be sourced to the record (Fact Table / correspondence),
  never asserted by default.

## 4. Process

### Phase 0 — Extract the Arbitration Clause

Locate the dispute resolution clause in the contract and extract it in
full into working notes. Tag each component:

| Component | Value | Clause reference |
|---|---|---|
| Institution named | | |
| Rules referenced (incl. any edition/year stated) | | |
| Seat / place of arbitration | | |
| Language of arbitration | | |
| Number of arbitrators / appointment mechanism | | |
| Scope of clause (e.g. "any dispute arising out of or in connection with...") | | |
| Conditions precedent (negotiation/mediation period, notice requirements) | | |
| Governing (substantive) law clause | | |
| Any carve-outs (interim relief via courts, emergency arbitrator opt-out, etc.) | | |
| Confidentiality provisions | | |

If the contract has been amended, assigned, or novated, check whether the
arbitration clause was carried over unchanged — flag if not.

### Phase 1 — Determine the Applicable Rules Edition (Verification Required)

1. Note exactly what the clause says about rules: does it name a specific
   edition (e.g. "DIS Arbitration Rules 2018"), or does it refer generally
   to "the Rules of [Institution]" without a year?
2. **Search the institution's current official rules** to establish: (a)
   the current edition in force, (b) its effective/applicability date, and
   (c) the institution's own transitional provision governing which
   edition applies to a given arbitration (most institutional rules
   contain an article addressing this — commonly turning on the date the
   arbitration was commenced, filed, or requested, not the date the
   contract was signed).
3. Apply that transitional provision to this matter's facts (contract
   date, and date the arbitration was/will be commenced) to determine the
   governing edition:
   - If the clause names a fixed edition, that edition ordinarily governs
     regardless of later revisions — but confirm this against the
     institution's own transitional rule, since some institutions apply
     the rules in force at commencement even where the clause names an
     edition, unless the clause specifies otherwise.
   - If the clause is silent on edition, the edition in force at
     commencement of the arbitration ordinarily governs — confirm the
     specific commencement-triggering event and date from the case record.
4. Record the determination with its source (official rules text,
   including the transitional article relied on) and a clear statement of
   which edition governs and why. If there is a genuine ambiguity (e.g.
   contract predates a rules revision and the transitional provision is
   itself unclear), flag it for counsel rather than choosing one reading.

### Phase 2 — Applicable Substantive Law

1. Identify the express governing-law clause, including any exclusions
   named in it (e.g. exclusion of the CISG, exclusion of renvoi/conflict
   rules of the chosen jurisdiction).
2. Keep the **substantive governing law** and the **procedural law of the
   seat** analytically separate — do not conflate them in the draft, even
   though both may need to be mentioned.
3. If there is no express choice of law, do not select one. This is a
   conflict-of-laws legal judgment for counsel — flag it as needing
   analysis rather than resolving it.
4. Note, only if apparent from the contract or Fact Table, any specific
   statutory regime the substantive law clause triggers (e.g., a sale-of-
   goods regime) — but do not draft legal argument here; that belongs to
   the substantive sections.

### Phase 3 — Jurisdictional Status Check

1. Cross-reference the Fact Table and correspondence for any indication
   the Respondent has contested jurisdiction, the seat, the scope of the
   clause, or the applicable rules. If any such position exists in the
   record, **do not draft the simple "uncontested jurisdiction" form of
   this section.** Flag that jurisdiction is contested and that a fuller
   jurisdictional submission (addressing the specific objection) is
   needed — that is outside this skill's scope and should be escalated to
   the lawyer.
2. Check the clause's scope language against the causes of action in the
   Legal Theory Brief. A narrow clause (e.g. limited to disputes "under
   this Agreement") may not obviously capture a tortious or statutory
   claim pleaded alongside the contractual one — flag any claim that looks
   like it may sit outside the clause's scope for counsel's view, rather
   than assuming full coverage.
3. If the clause contains a condition precedent (e.g. a mandatory
   negotiation or mediation period before arbitration may be commenced),
   check the Fact Table for evidence that it was satisfied (dates of
   demand letters, negotiation correspondence, etc.) before drafting a
   statement that the Tribunal's jurisdiction is properly engaged. Flag if
   the record doesn't clearly evidence compliance.

### Phase 4 — Draft the Section

Two short paragraphs, calibrated to the reference precedent:

1. **Jurisdiction paragraph** — the Tribunal's jurisdiction derives from
   [clause] of [contract] (Exhibit reference); rules and edition (as
   determined in Phase 1, with its effective basis); seat; language;
   arbitrator number/appointment mechanism if material; and the
   jurisdictional status statement (contested/uncontested) exactly as
   supported by Phase 3.
2. **Applicable law paragraph** — the substantive law as expressly chosen,
   any exclusions, and the general regime it invokes, without arguing the
   substantive law's application to the facts.

### Phase 5 — Verification

**(a) Grounding check.** Every clause detail in the draft traces to the
Phase 0 extraction table; every rules-edition statement traces to the
Phase 1 verified source (with its effective date and transitional basis);
every jurisdictional-status statement traces to a Fact Table entry.

**(b) Currency check.** Confirm the rules-edition determination was based
on a current search of the institution's official rules, not recalled
from memory — if this step was skipped, it must be run before the
draft is finalised.

**(c) Consistency/completeness flags.** List: any contested-jurisdiction
finding (Phase 3.1), any scope mismatch (Phase 3.2), any unevidenced
condition precedent (Phase 3.3), any missing express choice of law (Phase
2.3), and any clause carried over ambiguously through an amendment/
assignment (Phase 0).

### Phase 6 — Output Package

1. **Clean draft** — the two-paragraph Jurisdiction and Applicable Law
   section.
2. **Clause Extraction Table** and **Rules Edition Determination note**
   (with verified source and effective date).
3. **Flags list** — contested jurisdiction, scope mismatches, unevidenced
   conditions precedent, missing choice-of-law, and any rules-edition
   ambiguity.

## 5. Guardrails

- Never state which rules edition applies without having verified it
  against the institution's current official rules text in this session.
- Never assert jurisdiction is uncontested without a Fact Table source
  confirming it.
- Never resolve an absent choice-of-law clause on the model's own
  authority.
- Never draft the "uncontested jurisdiction" short form where the record
  shows an actual jurisdictional objection — escalate instead.
- Keep the substantive-law paragraph to a statement of what law applies,
  not an argument about how it applies to the facts.

## 6. Reference Calibration

The reference precedent's Section III — one paragraph on jurisdiction
(clause, rules edition, seat, language, uncontested status) and one on
applicable law (substantive law, exclusion, statutory regime named) — is
the target length and register.
