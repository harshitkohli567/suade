---
name: quantum-of-loss
description: >
  Use this skill to draft the Quantum of Loss section of a Statement of
  Claim — determining which heads of loss are actually recoverable (as
  opposed to merely incurred), screening every head for limitation/
  time-bar issues, generating and comparing legitimate valuation
  methodologies, and producing the final heads-of-loss table with
  supporting legal reasoning. Trigger this skill whenever the lawyer asks
  to draft quantum, calculate damages, work out whether a claim is
  time-barred, or quantify a loss. This skill must always be used instead
  of a single-pass "calculate the damages" prompt — quantum drafting fails
  most often not on arithmetic but on pleading a loss that is time-barred,
  legally unrecoverable, or valued by a methodology that outstrips what the
  evidence actually supports.
---

# Skill: Quantum of Loss

## 1. Purpose

Not every loss the client actually incurred can be pleaded, and not every
head of loss that can be pleaded is quantified the same way. This skill
runs every candidate head of loss through two gates — limitation and legal
recoverability — before it is ever valued, and then values each surviving
head using a methodology chosen for its legal soundness first, and only
among sound alternatives, for the highest defensible value. It also
flags interest basis and relief-type compatibility, both of which
interact with quantum but belong properly to their own sections/skills.

## 2. Required Inputs

1. **Causation section / causal chain map**, so every head of loss can be
   tied to a specific element of the established causal chain — quantum
   never pleads a freestanding loss with no causal link already built.
2. **Jurisdiction and Applicable Law section**, for the governing law that
   limitation and damages-recoverability analysis must be rooted in —
   reuse this, do not re-derive governing law here.
3. **The underlying contract**, for any exclusion clauses (e.g.
   consequential-loss exclusions), interest clauses, and any contractual
   notice/claim periods distinct from statutory limitation.
4. **Underlying loss evidence** — invoices, cost schedules, cover-purchase
   agreements, lost-profit projections, expert quantum reports. Every
   figure in the final draft must trace to one of these.
5. **Commentary/treatise excerpts on limitation and damages doctrine**, if
   the lawyer has them — used the same way as in the Causation and Breach
   skills (Commentary Cross-Check Tool), to source the legal tests rather
   than assume them.
6. **Legal Theory Brief**, for the initial candidate list of heads of loss
   being considered.

## 3. Non-Negotiable Rules

- **No invented limitation period or accrual rule.** Period length and the
  rule for when time starts running must be sourced from statute,
  supplied commentary, or explicit lawyer confirmation.
- **No invented damages-recoverability doctrine.** Foreseeability,
  remoteness, direct-vs-consequential distinctions, and mitigation
  standards must be sourced the same way.
- **No invented figures.** Every value in the draft traces to a specific
  source document, invoice, or expert report.
- **Legal soundness screens value, never the reverse.** A quantification
  methodology is only ranked by resulting value among methodologies that
  have already passed the legal/evidentiary soundness check. A
  higher-value but doctrinally weaker methodology is never presented as
  the lead option — it is logged as excluded, with the reason, so the
  choice is visible and auditable rather than hidden.
- **No silent exclusion.** A head of loss excluded for limitation,
  recoverability, or evidentiary reasons is logged in the Gap/Exclusion
  Report with the reason — it disappears from the draft, never from the
  record.

## 4. Process

### Phase 0 — Candidate Heads of Loss Register

List every head of loss raised by the client or appearing in the loss
documents:

| Head of loss | Description | Supporting documents | Rough figure | Linked breach (Breach skill output) | Linked causal element (Causation skill output) |

Everything here is a **candidate only** — nothing is cleared for pleading
until it passes Phases 1 and 2.

### Phase 1 — Limitation / Time-Bar Screening (per head of loss)

This is the analysis the practitioner note specifically flagged as
essential and easy to get wrong silently. Run it per head, not once for
the claim as a whole — different heads can have different accrual dates.

1. **Confirm governing law** from the Jurisdiction and Applicable Law
   section — do not re-derive.
2. **Categorize the claim type** for this head under that law (e.g.
   contractual damages claim, debt claim, restitutionary claim) — this
   affects which limitation period applies and is often a genuine legal
   judgment call. Source the categorization; flag it for the lawyer's
   confirmation if more than one characterization is plausible.
3. **Determine the applicable limitation period length** for that
   category, sourced from statute or commentary — never assumed by
   analogy to a different claim type.
4. **Determine the accrual (trigger) date — as a set of candidate
   theories, not a single silent choice.** Common competing theories
   include: date of the breach/default itself, date of a formal demand or
   notice to cure, date the defect/loss was discovered, and date the loss
   crystallized (e.g. cost actually incurred). For each candidate theory,
   state its legal basis (sourced) and the resulting accrual date on this
   matter's facts. **Do not pick one silently** — present the set, with
   reasoning for each, and flag which theories the model considers
   stronger and why, but treat the final choice as the lawyer's.
5. **Check for tolling/suspension events** — settlement negotiations,
   standstill agreements, notices — sourced both from the correspondence
   record (Fact Table) and from the applicable law's own tolling rules.
6. **Apply period + each candidate accrual date** to the date the
   arbitration was (or will be) commenced, to compute whether the head is
   time-barred under each theory.
7. **Output a Limitation Determination per head**:
   `Clearly within limitation` / `Clearly time-barred (all plausible
   theories)` / `Contested — outcome depends on accrual theory [list
   theories and outcomes]`.

A head that is `Clearly time-barred` under every plausible theory is
**excluded** from the draft and logged in the Gap/Exclusion Report with
reasoning. A `Contested` head is flagged prominently for the lawyer's
decision before quantification proceeds — the accrual theory adopted can
change both whether the head survives and, in some cases, the figure
itself.

### Phase 2 — Legal Recoverability Screening (per head surviving Phase 1)

Not everything spent or lost "under" the contract is a recoverable
damages head. Build a Recoverability Checklist per head, sourced the same
way as the Causation/Breach skills' element checklists, covering:

- **Causal link** — re-confirm this head maps to a specific element of
  the Causation skill's established chain, not a freestanding assertion.
- **Foreseeability/remoteness**, if the governing law applies such a test
  — was this type of loss foreseeable at the relevant time (commonly
  contract formation), sourced from doctrine, not assumed.
- **Contractual exclusions** — check the contract for consequential-loss
  exclusions, liability caps, or other clauses that might exclude or limit
  this specific head; flag any head a clause appears to target (and
  cross-reference the Liability Cap section/skill if drafted separately).
- **Mitigation** — confirm, from the Factual Background, that the
  claimant took reasonable steps to mitigate this specific head; flag any
  head where mitigation isn't yet evidenced.

Output per head: `Recoverable — elements satisfied [citations]` /
`Excluded — contractual exclusion [clause]` / `Doubtful — remoteness/
foreseeability concern, flag for counsel` / `Gap — mitigation not yet
evidenced`.

Only `Recoverable` heads proceed to Phase 3.

### Phase 3 — Quantification Methodology Generation

For each recoverable head, first classify its natural valuation family —
these require materially different evidentiary support and should not be
approached with one generic "calculate the loss" instruction:

- **Cost-based / out-of-pocket** (e.g. recall costs, investigation costs)
  — value from actual costs incurred, cited to invoices/schedules.
- **Market-based / differential** (e.g. cover-purchase price differential)
  — value from a comparator transaction, cited to the comparator
  contract/invoices.
- **Lost profits / but-for comparator** — requires constructing a
  defensible but-for scenario (what would have happened absent the
  breach); higher evidentiary bar; flag if not yet supported by expert/
  financial modeling evidence rather than estimating one.
- **Notional/hypothetical loss** (e.g. diminution in value with no
  completed transaction) — requires the governing law to actually
  recognise this valuation basis; flag as needing doctrinal confirmation
  before quantifying, since recoverability of notional loss is itself
  often contested.

Where more than one legitimate methodology could value the same head
(e.g. lost profits via historical baseline vs. via a projected but-for
market share), generate the plausible alternatives — as many as are
genuinely defensible, not padded to a fixed count — each with:

| Methodology | Legal/doctrinal basis (sourced) | Evidentiary basis required | Resulting figure (only if evidenced) | Soundness assessment |

**Soundness assessment** should flag risks like: does this methodology
track the loss actually caused by this specific breach, or does it risk
over-inclusion, requires unevidenced assumptions, or double-counts against
another head?

**Ranking discipline:** rank methodologies by resulting value **only
among those that pass the soundness assessment.** A methodology that
fails soundness is logged as `Excluded — not legally/evidentially
defensible [reason]`, visibly, not omitted from the output — the lawyer
should be able to see it was considered and why it was set aside.

**Cross-head double-counting check.** After generating methodologies for
all heads, scan the full register for overlap — e.g. a cover-purchase
differential and a lost-profits claim both partially capturing the same
commercial disruption — and flag any overlap found.

### Phase 4 — Lawyer Confirmation Gate

Present the ranked, sound methodologies per head for the lawyer's
selection before finalising figures. This mirrors the practitioner's own
review process: check the logic, exclude what doesn't hold up, and among
what remains, select the option that maximises defensible value. This
skill produces that comparison — it does not auto-select the highest
figure and present it as final without this checkpoint.

### Phase 5 — Interest Basis (light-touch)

- Determine the basis for an interest claim on each head: contractual
  interest clause (if any) vs. statutory default rate — sourced, not
  invented; flag if the contract is silent and a statutory default needs
  confirming.
- Determine the interest accrual start date per head. This is a
  **distinct legal question from the limitation accrual date** in Phase
  1, even though both concern "when did the clock start" — do not assume
  they share the same trigger under the governing law without checking.
- Note: full drafting of a standalone Interest section is better handled
  by its own skill when built. This phase exists only to keep the Quantum
  section internally consistent with whatever the Interest section will
  later say.

### Phase 6 — Relief-Type Compatibility Flag (light-touch)

Confirm that the monetary damages relief being quantified here is a type
of relief the seat's arbitration law and applicable institutional rules
permit an arbitral tribunal to grant. Flag, rather than assume, if any
head is framed as something other than a straightforward damages claim
(e.g. specific performance in kind, or anything with an in rem character)
— some arbitration laws restrict tribunals to in personam relief. Full
relief-type screening across all remedies belongs to a future Relief
Sought skill; this phase only checks the monetary heads handled here.

### Phase 7 — Draft the Section

1. State the general legal basis for recoverability of damages under the
   governing law (sourced).
2. Present each surviving, recoverable head in a table — number, head of
   loss, amount, evidentiary/exhibit source — matching the reference
   precedent's format.
3. Note any reservation of the right to update quantum if the loss is
   still developing (e.g. an ongoing recall), as in the reference
   precedent.
4. Excluded heads (time-barred, unrecoverable, unevidenced) do **not**
   appear in the draft — but every one of them appears in the
   Gap/Exclusion Report (Phase 9) with its reason.

### Phase 8 — Verification

**(a) Grounding check.** Every figure traces to a source document; every
legal conclusion traces to sourced law.

**(b) Limitation screen audit.** Every head in the final draft carries a
Phase 1 status of `Clearly within limitation` or a lawyer-confirmed
accrual theory — no `Contested` head appears without that confirmation
logged.

**(c) Recoverability screen audit.** Every head in the final draft carries
a Phase 2 status of `Recoverable`, with citations.

**(d) Double-counting check.** Confirm no undisclosed overlap between
heads.

**(e) Soundness-before-value check.** Confirm no methodology was adopted
for its value over a more legally defensible lower-value alternative
without the Phase 4 lawyer sign-off being logged.

**(f) Causal-link cross-check.** Every head maps to the Causation skill's
established chain.

### Phase 9 — Output Package

1. **Clean draft** — the Quantum of Loss section with heads-of-loss table.
2. **Candidate Heads of Loss Register** (Phase 0).
3. **Limitation Determination Table** — per head, with accrual theories and
   outcomes (Phase 1).
4. **Recoverability Checklist** — per head (Phase 2).
5. **Quantification Methodology Comparison** — all methodologies
   considered, sound vs. excluded, ranked by value among sound ones
   (Phase 3).
6. **Interest Basis Note** (Phase 5).
7. **Relief-Type Compatibility Flags** (Phase 6).
8. **Gap/Exclusion Report** — every excluded head (time-barred,
   unrecoverable, unevidenced), with reasoning — nothing disappears
   silently.

## 5. Guardrails

- Never invent a limitation period, accrual rule, or damages doctrine.
- Never invent a figure not traceable to source evidence.
- Never present a methodology ranked by value ahead of legal soundness.
- Never drop a head of loss from the draft without logging why in the
  Gap/Exclusion Report.
- Never let interest-accrual analysis silently borrow the limitation
  accrual date without checking they're actually the same trigger.
- Treat relief-type compatibility as a flag for this skill, not a full
  screening exercise — that belongs to the Relief Sought skill.

## 6. Reference Calibration

The reference precedent's Section IX — a stated legal basis for
recoverability, a heads-of-loss table with exhibit citations for each
figure, and an explicit reservation of the right to update quantum — is
the target format. The limitation, recoverability, and methodology-
comparison analysis behind it is not visible in the final precedent text
(as is proper — it's reasoning, not pleading) but must exist and be
auditable in this skill's working outputs.
