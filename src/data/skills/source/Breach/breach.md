---
name: breach
description: >
  Use this skill to draft the Breach section of a Statement of Claim —
  describing what the respondent did wrong, identifying the specific
  contractual and/or statutory provisions that were breached, and
  providing the legal justification connecting the facts to each element
  of the applicable standard. Trigger this skill whenever the lawyer asks
  to draft the breach/non-conformity/defect section, to establish that a
  party's conduct breached a specific clause or statutory provision, or to
  apply a contractual/statutory standard to the facts. This is distinct
  from the Causation skill (which proves the breach caused the loss) and
  the Quantum skill (which values the loss) — this skill must always be
  used instead of freehand breach drafting, and must not itself argue
  causation or quantum.
---

# Skill: Breach

## 1. Purpose

Establish, element by element and with sourced legal provisions, that the
respondent's conduct did not meet the standard it was contractually or
statutorily bound to meet. This section answers one question only: *was
there a breach* — not why it happened, not what it cost. Causation and
quantum are deliberately out of scope here; keeping the boundary clean
means each section can be tightened independently without the argument
sprawling across all three.

## 2. Required Inputs

1. **Main Proposition Elements Table**, for the specific breach
   proposition(s) this section is arguing — reuse the contractual
   clause(s) and statutory provision(s) already confirmed there rather
   than re-sourcing them from scratch. If this section identifies a
   provision not yet in that table, add it there with the same citation
   discipline (see Non-Negotiable Rules), don't treat this section as a
   shortcut around that verification step.
2. **Factual Background section** (numbered paragraphs and exhibits), as
   the sole source of facts applied to each element.
3. **Commentary/treatise excerpts, if the lawyer has any**, on how the
   specific standard (e.g. what counts as "conformity," "quality agreed,"
   or a particular defined term in the contract) has been interpreted —
   optional, but if supplied, run the Commentary Cross-Check Tool (Phase
   1) the same way the Causation skill does, rather than relying on the
   model's own reading of the term.
4. **Fact Table / correspondence**, for the respondent's actual stated
   position on whether a breach occurred (as opposed to their position on
   what caused any non-conformity, which belongs to the Causation skill).

## 3. Non-Negotiable Rules

- **No invented legal standard.** The definition of what constitutes
  breach/non-conformity/defect under the relevant provision must be
  sourced to the actual statutory text, the actual contract clause, or
  supplied commentary — never to the model's general recollection of what
  such a standard "usually" requires.
- **No element asserted as satisfied without a Factual Background
  citation.** "The Modules were defective" is a conclusion; it must be
  built from cited facts establishing each element of the applicable
  standard.
- **No causation or quantum content.** This section states that the
  standard wasn't met; it does not explain why that caused the loss (Causation
  skill) or what the loss is worth (Quantum skill). If drafting drifts into
  either, cut it and route it to the correct skill.

## 4. Process

### Phase 0 — Confirm the Applicable Standard(s)

Pull the specific contractual clause(s) and statutory provision(s) for
this breach proposition from the Main Proposition Elements Table. If more
than one provision is in play (e.g. a specific contractual warranty *and*
a general statutory conformity requirement), treat them as **separate
standards to be addressed separately** in Phases 1–2 — do not merge two
distinct legal bases into one loose paragraph, since a Tribunal (or the
Statement of Defence) may accept one basis and reject the other, and the
draft needs to survive either finding independently.

### Phase 1 — Legal Standard Element Extraction (Commentary Cross-Check Tool)

For each standard identified in Phase 0, extract its constituent elements
into a checklist — from the statutory/contractual text itself, and from
any supplied commentary interpreting a specific term:

| Element | Source (statute/clause text or commentary pinpoint) | Notes on interpretation |

This must always include an explicit **"relevant time" element** — the
moment at which the standard had to be met (e.g. passing of risk on
delivery for a sale-of-goods conformity standard, versus continuous
performance for an ongoing obligation). Source this from the statute or
clause; do not assume it defaults to the date of the contract or the date
the problem was discovered without checking.

If commentary is supplied and interprets a term relevantly, apply the same
applicability check used in the Causation skill: does the commentary's own
stated scope actually match how this term is used in this contract/
statute, or does it address a different context? Flag mismatches rather
than assuming transferability.

### Phase 2 — Map Facts to Elements

For each element in the Phase 1 checklist, build:

| Element | Supporting fact(s) (Factual Background ¶ / exhibit) | Satisfied? |

`Satisfied?` is one of `Yes — cited`, `Contested — see Phase 4`, or
`Gap — no clear factual support yet`. An element with a `Gap` status must
not be drafted as satisfied — flag it instead.

### Phase 3 — Handle Multiple Provisions Separately

Where Phase 0 identified more than one applicable standard, keep a
distinct Phase 1/Phase 2 pairing for each, and draft them as distinct
sub-arguments in Phase 5 (even if they end up in the same numbered
paragraphs) — the point is that each stands or falls on its own citation
chain, not that they must be visually separated in the final prose.

### Phase 4 — Breach-Specific Defense Register

Distinct from the Causation skill's Alternative Cause Register (which
addresses what *caused* a loss), this register addresses disputes about
whether the standard was met **at all**, or **at the relevant time** —
e.g. a respondent's position that the goods conformed at delivery and any
non-conformity arose afterward, that the observed deviation falls within
an agreed tolerance, or that a contractual term means something different
than the claimant's reading.

| Respondent's position | Source: actual (correspondence) or anticipated | Rebuttal (Factual Background/exhibit citation) | Status |

Same discipline as other registers in this library: actual positions
(sourced from correspondence) must be addressed, not optional; anticipated
positions are flagged as such; nothing is marked resolved without a
citation. If a position raised is actually about *cause* rather than
*whether a breach occurred* (e.g. "the failure was caused by your own
misuse"), that belongs in the Causation skill's register — flag it and
route it there rather than duplicating or arguing it here.

### Phase 5 — Draft the Section

For each standard from Phase 0, in order:

1. State the standard and its source (statutory/contractual citation).
2. Apply it element by element from the Phase 2 map, explicitly addressing
   the "relevant time" element.
3. Address any live dispute from the Phase 4 register concerning that
   standard, with the cited rebuttal.
4. State the conclusion: breach of [clause] and/or [statutory provision],
   citing both together where both apply (as in the reference precedent's
   "breach of the warranty in Clause 11 and of its statutory obligation...
   under §§ 433(1) and 434 BGB").

Keep the register concise and declarative — this section proves
non-conformity, not the full narrative (already told in the Factual
Background) and not the consequences (told in Causation and Quantum).

### Phase 6 — Verification

**(a) Grounding check.** Every element application traces to a Factual
Background paragraph or exhibit; nothing is asserted from memory.

**(b) Elements coverage check.** Every element in each Phase 1 checklist
is addressed in the draft, or explicitly flagged as a `Gap`.

**(c) Provision-citation audit.** Every statutory/contractual citation
used has `Status: Confirmed` in the Main Proposition Elements Table (or
was added there with equivalent verification in Phase 0) — never draft
from an unconfirmed citation.

**(d) Scope-boundary check.** Scan the draft for causation language
("...which caused...", "...as a result...") or valuation language
("...amounting to...") that belongs in other sections — cut and route it.

**(e) Defense-disposition check.** Every entry in the Phase 4 register has
a status; nothing is silently unaddressed.

### Phase 7 — Output Package

1. **Clean draft** — the Breach section.
2. **Legal Standard Element Checklists** — one per standard addressed.
3. **Facts-to-Elements Map** — per standard.
4. **Breach-Specific Defense Register** — with dispositions.
5. **Gap Report** — unsatisfied elements, unconfirmed citations, and any
   content flagged for routing to Causation or Quantum.

## 5. Guardrails

- Never state a legal standard for breach without a sourced basis.
- Never mark an element "satisfied" without a Factual Background citation.
- Never merge distinct contractual and statutory bases into one
  unstructured argument — address each on its own element chain.
- Never let causation or quantum argument sit inside this section.
- Never resolve a respondent's actual stated position on breach without
  citing the evidence that answers it.

## 6. Reference Calibration

The reference precedent's Breach section — stating the statutory
conformity standard, identifying the relevant time as the passing of
risk, applying the independent expert report's finding that the defect
existed (albeit latently) at that time, and concluding breach of both the
contractual warranty and the statutory provision together — is the target
structure, length, and citation density.
