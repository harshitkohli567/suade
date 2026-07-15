---
name: causation
description: >
  Use this skill to draft the Causation section of a Statement of Claim —
  the section that proves the claimant's loss was in fact caused by the
  respondent's breach, as distinct from the Breach section (which
  establishes non-conformity/wrongdoing) and the Quantum section (which
  values the loss). Trigger this skill whenever the lawyer asks to draft
  causation, to address an alternative-cause defence, to work out the
  applicable causation test or burden of proof, or pastes in commentary/
  treatise excerpts and asks whether they apply to the case. This skill
  must always be used instead of freehand causation drafting — proving
  causation requires (a) a sourced doctrinal test, not an assumed one, (b)
  a sourced burden-of-proof allocation, and (c) systematic, evidenced
  elimination of every plausible alternative cause, not just assertion of
  the claimant's preferred cause.
---

# Skill: Causation

## 1. Purpose

Facts and law are not, by themselves, causation. The Factual Background
establishes what happened; the Breach section establishes that it was
wrongful; this skill establishes — to the standard and burden actually
applicable under the governing law — that the respondent's breach, and
not something else, caused the claimant's loss. That requires two things
most drafting skips past: an explicit doctrinal test (sourced, not
assumed) applied element by element, and a systematic accounting of every
plausible alternative cause, each one affirmatively closed off with
evidence rather than left for the Tribunal to dismiss on its own.

## 2. Required Inputs

1. **Factual Background section** (numbered paragraphs), as the source of
   the facts the causal chain is built from — this skill does not
   re-derive facts, it cites into the existing paragraph numbers.
2. **Breach section / Main Proposition Elements Table**, so the causal
   chain connects to the specific breach already pleaded, not a
   freestanding theory of wrongdoing.
3. **Commentary or treatise excerpts on causation, supplied by the
   lawyer**, covering the applicable law's causation test and (where
   addressed) burden-of-proof rules. This is the input the Commentary
   Cross-Check Tool (Phase 1) operates on. If none are supplied yet, ask
   for them before drafting the causation test section — do not supply
   the doctrinal test from the model's own general knowledge.
4. **Fact Table / correspondence** (from Brief Summary of Facts skill),
   specifically for any causation theory the respondent has already
   asserted (e.g. in a defence letter or pre-action correspondence) — this
   must be addressed as an actual, sourced counter-theory, not a
   hypothetical one.
5. **Any expert reports or technical evidence** bearing on mechanism of
   harm and on excluding alternative causes.

## 3. Non-Negotiable Rules

- **No invented causation doctrine.** The specific test applied (e.g. a
  "but-for" analysis, a two-stage factual/legal causation framework, a
  named doctrinal standard) must be sourced to the commentary/treatise
  excerpts supplied, to statutory text already confirmed in the Main
  Proposition Elements Table, or to explicit lawyer confirmation. If none
  of these establish the test, flag it and stop — do not proceed with a
  test recalled from general training knowledge.
- **No invented burden-of-proof allocation.** The default rule in most
  civil systems is that the party alleging causation bears the burden of
  proving it — but burden-shifting rules (presumptions, prima facie
  evidence doctrines, reversed burdens in specific regulatory or
  product-liability contexts) are highly fact- and jurisdiction-specific.
  Never assume a shifted burden applies to this case merely because the
  fact pattern resembles a category where shifting sometimes occurs
  elsewhere — confirm it against sourced authority for this jurisdiction
  and this type of claim.
- **No alternative cause "ruled out" without cited evidence.** Asserting
  that an alternative explanation is wrong is not the same as
  demonstrating it with evidence. Every alternative cause addressed in
  this section must carry a citation to the fact or expert evidence that
  excludes or discounts it.

## 4. Process

### Phase 1 — The Commentary Cross-Check Tool

This is the mechanism for grounding the causation test in authority the
lawyer controls, rather than the model's own doctrinal recall.

1. Take the commentary/treatise excerpt(s) supplied by the lawyer.
2. Extract, verbatim-sourced, the test or elements the commentary states
   are required to establish causation under the applicable law — build a
   **Causation Elements Checklist**:

   | Element (as stated in commentary) | Commentary source (pinpoint) | Applies to this case type? |

3. **Applicability check.** For each element, assess whether the
   commentary's own stated scope actually covers this case's fact pattern
   and cause of action (e.g. a commentary addressing tortious causation
   may not transpose cleanly onto a contractual damages claim, or a
   passage addressing causation for personal injury may use a different
   framework than one for pure economic loss). Flag any element where the
   applicability is unclear rather than assuming transferability.
4. **Conflict handling.** If the lawyer supplies more than one commentary
   excerpt and they state the test differently, do not silently pick one
   — record both, flag the conflict, and ask which the lawyer wants
   applied (or whether both need to be addressed, e.g. because the
   Tribunal may look to either).
5. This checklist becomes the coverage standard for Phase 5 — every
   element on it must be visibly addressed in the drafted section.

### Phase 2 — Burden and Standard of Proof

1. Identify the default burden-of-proof position for this cause of
   action under the applicable law, sourced the same way as Phase 1
   (commentary, confirmed statute, or lawyer confirmation).
2. Check specifically whether any burden-shifting doctrine could apply —
   e.g. a statutory presumption, a prima facie evidence rule, or a
   reversed burden that applies once certain threshold facts are shown
   (the general pattern being: proof of a triggering fact shifts the
   burden to the other side to disprove fault, as in some regulatory or
   product-defect contexts). Treat this as a pattern to actively check
   for, not a rule to assume applies — it must be confirmed against
   sourced authority for this specific claim type before being relied on.
3. Note the standard of proof (e.g. balance of probabilities) if the
   supplied authority addresses it.
4. Output a **Burden/Standard Determination**, sourced, or explicitly
   flagged as unconfirmed and defaulting to the conventional
   claimant-bears-the-burden position pending confirmation.
5. If contributory conduct by the claimant is in issue, separately
   determine (same sourcing discipline) which party bears the burden of
   establishing it — this is often a distinct allocation from the primary
   causation burden.

### Phase 3 — Build the Affirmative Causal Chain

Using the Causation Elements Checklist from Phase 1 as the structure, walk
through each element and show how the record satisfies it:

- Cite the specific breach (by reference to the Breach section /
  Factual Background paragraph).
- Cite the mechanism connecting that breach to the harm (technical/expert
  evidence, with citation).
- Cite the resulting loss (cross-reference to what will be the Quantum
  section, without re-arguing valuation here).
- Address each checklist element explicitly and in the order the
  commentary presents them, unless a different order is clearly more
  natural for this fact pattern — but do not skip an element silently.

### Phase 4 — Alternative Cause Register (Systematic Elimination)

Build a register of every plausible alternative cause of the loss:

| Alternative cause | Source: opposing party's stated position, or anticipated | Rebuttal evidence (citation) | Status |

1. **Pull actual opposing-party theories first**, sourced from
   correspondence/Fact Table — tag `Opposing party's stated theory`. These
   must be addressed; they are not optional.
2. **Add anticipated alternative causes** — other plausible explanations
   suggested by the technical record, even if not yet raised by the other
   side — tag `Anticipated / not yet raised`. Generate this list from a
   careful read of the factual and technical record, not from
   speculation untethered to it.
3. **This list is a starting point, not a guarantee of exhaustiveness.**
   Ruling out *every* conceivable cause of a technical failure typically
   requires domain expertise the model does not have. Flag explicitly
   that the lawyer and any retained expert should review and supplement
   this register — this skill cannot certify completeness on a technical
   question on its own.
4. For each entry, `Status` is one of: `Ruled out — evidence cited`,
   `Substantially discounted — evidence cited`, `Evidentiary gap —
   requires expert evidence`, `Unaddressed`. **No entry may be marked
   "ruled out" without a citation to the evidence that does so.** An
   alternative cause with no rebuttal evidence yet available should be
   marked as an evidentiary gap and flagged to the lawyer, not asserted
   away.

### Phase 5 — Draft the Section

Structure, calibrated to the reference precedent's causation section:

1. State the causation test being applied, with its source (from Phase 1).
2. Walk through the affirmative causal chain (Phase 3), element by
   element.
3. Address the opposing party's actual counter-theory, if any, with the
   specific rebuttal evidence from the Alternative Cause Register — this
   is where most of the section's persuasive weight sits, as in the
   reference precedent's treatment of the BMS-calibration and cooling
   counter-theory.
4. Address any other alternative causes from the register that a Tribunal
   might independently consider, even if not raised by the other side, if
   materially plausible.
5. Address burden of proof / contributory-fault allocation (Phase 2), if
   in issue.
6. Close with the conclusion the elements support — that what remains,
   once the alternatives are excluded, is the respondent's breach as the
   cause.

Style: persuasive through evidentiary density and systematic elimination,
not through adjectives — let the closing-off of each alternative carry the
weight.

### Phase 6 — Verification

**(a) Grounding check.** Every causal link and every rebuttal traces to a
cited source (Factual Background paragraph, exhibit, expert report, or
commentary excerpt).

**(b) Elements coverage check.** Cross-check the draft against the Phase 1
Causation Elements Checklist — every element addressed, or flagged if not.

**(c) Alternative-cause completeness check.** Every entry in the Phase 4
register has a disposition; no entry is silently missing a status.

**(d) Burden-of-proof sourcing check.** Confirm the Phase 2 determination
is sourced, not assumed, and flagged if unconfirmed.

**(e) No-invented-doctrine check.** Confirm no causation-doctrine
terminology appears in the draft that isn't traceable to Phase 1's sourced
checklist or confirmed statutory text.

### Phase 7 — Output Package

1. **Clean draft** — the Causation section.
2. **Causation Elements Checklist** — from the Commentary Cross-Check Tool,
   with applicability notes.
3. **Burden/Standard of Proof Determination** — sourced or flagged.
4. **Alternative Cause Register** — with dispositions.
5. **Gap Report** — unaddressed elements, unrebutted alternative causes,
   unconfirmed burden allocation, and any evidentiary gaps flagged for
   expert input.

## 5. Guardrails

- Never state a causation test without a sourced basis from supplied
  commentary, confirmed statute, or explicit lawyer confirmation.
- Never assume a burden-shifting rule applies without sourced authority
  specific to this claim type and jurisdiction.
- Never mark an alternative cause "ruled out" without citing the evidence
  that does so.
- Never treat the model's own alternative-cause list as exhaustive on a
  technical question — flag it for expert/lawyer supplementation.
- Keep the causal analysis distinct from valuation — quantum belongs to
  its own section.

## 6. Reference Calibration

The reference precedent's Causation section — stating the opposing
theory, rebutting it point by point with specific evidence (operating
envelope data, cooling interface compliance, the independent expert
report's failure-mechanism findings), then addressing the burden for any
contributory-conduct argument — is the target structure and evidentiary
density.
