---
name: main-proposition
description: >
  Use this skill to draft the "Main Proposition" content in Section I
  (Introduction and Summary) of a Statement of Claim — the short, lettered
  sequence of numbered propositions ("First, ... Second, ... Third, ...")
  that sets out the core legal grounds on which the claim is brought.
  Trigger this skill whenever the lawyer asks for the claim to be
  "summarised in propositions," a "roadmap" of the case, the "main grounds"
  of the claim, or a lettered outline of the legal basis for the
  arbitration. This skill must always be used instead of freehand drafting
  of this paragraph — it enforces verified statutory citation and a
  cross-check against the rest of the Statement of Claim so the roadmap
  never promises something the document doesn't deliver.
---

# Skill: Main Proposition

## 1. Purpose

Produce the short, logically sequenced list of propositions that tells the
Tribunal, in one paragraph, *why the Claimant wins* — each proposition
corresponding to one link in the legal chain from breach/wrongdoing through
to remedy and quantum. Modelled on the reference precedent's five
propositions (defect → attribution/causation → procedural compliance →
valid termination → liability & quantum).

This is a **roadmap**, not an argument. Each proposition is a single
conclusory sentence naming its legal basis. The argument for each
proposition is made later, in the corresponding substantive section — this
skill's job is only to state the conclusion and point to where it is
proven.

## 2. Required Inputs

Do not draft until all of the following are available:

1. **Legal Theory Brief (lawyer-supplied).** The causes of action being
   pursued, their elements, the governing law, and the specific statutory
   or contractual provisions relied on. **This must come from the lawyer,
   not be inferred or invented by the model.** If the lawyer has not
   specified the governing statutory provisions, ask — do not guess a
   plausible-sounding citation.
2. **Output of the Brief Summary of Facts skill** (Fact Table + narrative),
   so propositions asserting factual conclusions can be checked against
   what the documents actually establish.
3. **The planned section structure (Table of Contents) of the Statement of
   Claim**, if fixed at this stage — e.g. "V. Breach," "VI. Notice," "VII.
   Causation," "VIII. Liability Cap," "IX. Quantum." If the ToC isn't fixed
   yet, this skill's output can *become* the basis for it (see Phase 3),
   but that should be an explicit, flagged output, not a silent assumption.

## 3. Non-Negotiable Rule: No Invented Law

**Never generate, complete, or "correct" a statutory citation, article
number, or case citation from general knowledge.** Legal citation is the
one place in this skill where a plausible-sounding but wrong output is
worse than no output — it is a professional liability issue, not just a
quality issue. Every citation in the final draft must be traceable to one
of:

- the Legal Theory Brief supplied by the lawyer,
- a governing-law clause or statutory reference already present in a
  source document (e.g. a contract's governing-law clause), or
- explicit lawyer confirmation given during this skill's drafting session.

If a proposition needs a citation that isn't yet confirmed, draft the
proposition with the citation marked `[CITATION TO BE CONFIRMED BY
COUNSEL]` rather than filling it in. Do not remove this marker without
explicit lawyer sign-off.

## 4. Process

### Phase 0 — Build the Elements Table

For each cause of action / remedy the lawyer intends to plead, create one
row:

| Element | Proposition claim (1 sentence) | Legal basis (statute/clause) | Status | Maps to SoC section | Fact support |

- **Status**: `Confirmed citation` / `Needs counsel confirmation` /
  `Sourced from contract clause`.
- **Maps to SoC section**: the section of the Statement of Claim where this
  proposition will actually be argued. If no such section exists yet in
  the plan, flag it — see Phase 3.
- **Fact support**: cross-reference to Fact ID(s) from the Brief Summary of
  Facts output, where the proposition asserts something factual (e.g. "the
  defect was present at the passing of risk" needs a supporting fact, not
  just a legal label).

### Phase 1 — Determine the Sequencing Logic

Propositions must follow the order in which they would logically have to
be established to win, not the order events happened chronologically. The
default architecture for a breach/defect-based claim (as in the reference
precedent) is:

1. **Breach/defect established** — the counterparty's performance did not
   conform to what was promised, under the applicable standard.
2. **Attribution/causation** — the defect is attributable to the
   counterparty and not to the claimant's own acts or omissions (pre-empts
   the most obvious defence).
3. **Procedural compliance** — the claimant satisfied any notice,
   inspection, or condition-precedent requirements needed to preserve its
   rights (pre-empts a time-bar/waiver defence).
4. **Remedy validly exercised** — where the claim depends on a party
   having validly exercised a contractual right (e.g. termination,
   rescission, price reduction), that exercise was valid.
5. **Liability and quantum** — the counterparty is liable in the amount
   claimed, and any liability limitation, cap, or exclusion does not bar
   recovery.

This is a **default**, not a fixed template. Other claim types
(e.g. pure damages claims with no termination, misrepresentation, tortious
claims, multi-contract disputes) will have a different natural sequence.
Confirm the applicable elements against the Legal Theory Brief rather than
mechanically forcing this five-step shape — the point is *logical
necessity ordering*, not a fixed count or fixed labels. If a step in the
above default doesn't apply (e.g. no termination is in issue), drop it
rather than padding to reach five propositions.

### Phase 2 — Draft the Propositions

For each row of the Elements Table, in sequence order, draft one sentence:

- Ordinal-led: "First, ... Second, ... Third, ..." (or lettered (a)–(e) as
  in the reference precedent).
- **One sentence per proposition.** If it needs two sentences, it is
  probably two propositions or one proposition carrying an argument it
  shouldn't yet be making.
- State the **conclusion**, not the reasoning. Compare the reference
  precedent's "the defect is a manufacturing defect internal to Castor's
  cells, and not the result of any act or omission of Helios" — this
  states the conclusion and pre-empts the defence in one line, without
  arguing the evidence for it.
- Name the specific statutory/contractual basis inline, exactly as
  confirmed in the Elements Table (or with the `[CITATION TO BE CONFIRMED
  BY COUNSEL]` marker).
- Where a proposition includes a figure (e.g. quantum), it must match the
  figure that will appear in the Quantum section — do not round or restate
  it differently.
- Use the same defined terms as the Brief Summary of Facts output
  (parties' short names, defined terms for the goods/services/contract).

### Phase 3 — Cross-Consistency Check

This is the check specific to this skill — it catches structural drift
between the roadmap and the document the roadmap is supposed to summarise.

**(a) Forward coverage check.** For every proposition, confirm a
corresponding section exists (or is planned) in the Statement of Claim
that will actually argue it. A proposition with no home section is a
promise the document won't keep — flag it.

**(b) Reverse coverage check.** For every planned major section of the
Statement of Claim, confirm at least one proposition previews it (sections
like Parties, Jurisdiction, Evidence, and Relief Sought are structural and
don't need their own proposition — but substantive liability sections do).
Flag any substantive section with no corresponding proposition.

**(c) Citation audit.** List every statutory/contractual citation used
across the propositions and confirm each has `Status: Confirmed citation`
or `Sourced from contract clause` in the Elements Table. Any proposition
still carrying `[CITATION TO BE CONFIRMED BY COUNSEL]` is flagged in the
output — never silently resolved.

**(d) Fact-grounding spot check.** For propositions asserting a factual
conclusion (as opposed to a pure legal one), confirm the `Fact support`
column is populated with a real Fact ID from the Brief Summary of Facts
output. A factual assertion with no supporting Fact ID is flagged, not
asserted.

### Phase 4 — Output Package

1. **Clean draft** — the finished lettered/ordinal propositions paragraph,
   ready for Section I.
2. **Elements Table** — full working table from Phase 0, updated with
   Phase 3 statuses.
3. **Flags list** — anything from the Phase 3 checks that isn't fully
   resolved: unconfirmed citations, uncovered sections, unsupported
   factual claims, sections with no proposition.

## 5. Guardrails

- Never invent or auto-complete a statute section number, article number,
  or case citation.
- Never let a proposition argue its point — conclusions only; the argument
  belongs in the mapped section.
- Never let the propositions and the Quantum section drift apart on
  figures — treat the propositions' number as downstream of the Quantum
  section's, not the other way around, once quantum is finalised.
- Keep proposition count driven by the actual number of logically distinct
  elements in the Legal Theory Brief — do not pad or compress to hit a
  particular number.
- Preserve strict logical sequencing (liability elements before remedy
  elements before quantum) even if that differs from event chronology.

## 6. Reference Calibration

The reference precedent's five propositions are the target register: one
sentence each, plain ordinal sequencing, each naming its statutory basis,
moving strictly from defect → attribution → procedural compliance →
remedy → liability/quantum. Use it to calibrate sentence length, citation
density, and ordering logic — not as a fixed slot count for every case.
