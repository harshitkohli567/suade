---
name: interest
description: >
  Use this skill to draft the Interest section of a Statement of Claim —
  determining the legal basis for an interest claim (contractual or
  statutory), the applicable rate mechanism, the accrual start date per
  head of loss, and, if requested, an illustrative calculation schedule.
  Trigger this skill whenever the lawyer asks to draft the interest claim,
  calculate interest owed, determine the applicable interest rate, or
  work out from what date interest should run. This skill must always be
  used instead of asserting "the statutory rate" or a contractual rate
  from memory — rate mechanisms are often tied to a floating reference
  rate that must be verified as of today, and the accrual date is a
  distinct legal question from the loss-incurred or limitation-accrual
  dates already used elsewhere in the Statement of Claim.
---

# Skill: Interest

## 1. Purpose

Produce the Interest section's legal basis and accrual logic, and —
where a numeric figure is actually wanted (e.g. as a supporting exhibit
rather than the pleading text itself, which typically stays open-ended
"until payment") — a verified, auditable illustrative calculation. The
underlying traps are narrow but easy to miss: assuming a rate without
checking whether it floats, reusing the limitation-accrual date as the
interest-accrual date without checking they're actually the same trigger,
and treating pre-award and post-award interest as one continuous,
unexamined question when the seat's law may treat them differently.

## 2. Required Inputs

1. **The contract**, for any express interest clause (rate, trigger,
   compounding treatment).
2. **Jurisdiction and Applicable Law section output**, for the governing
   substantive law that any statutory interest regime must be sourced
   from.
3. **Quantum of Loss skill output** — the Heads of Loss Register and each
   head's supporting dates — reused here, not re-derived, though the
   *interest* accrual date per head is a separate determination from the
   loss-incurred or limitation-accrual dates already established there
   (see Phase 2).
4. **Commentary/treatise excerpts on the applicable interest regime**, if
   the lawyer has them — used via the same Commentary Cross-Check Tool
   pattern as the Causation, Breach, and Quantum skills.
5. **Access to verify a current reference/base rate**, if the applicable
   regime ties the rate to a floating benchmark (see Phase 3) — this
   cannot be answered from memory.

## 3. Non-Negotiable Rules

- **No invented rate, formula, or compounding basis.** Whether interest is
  simple or compound, and what the rate or rate-formula is, must be
  sourced from the contract's own interest clause, the applicable statute,
  or supplied commentary — never assumed by analogy to a "typical"
  commercial rate.
- **No stale reference rate.** If the applicable regime ties the rate to a
  reference/base rate that adjusts periodically, that rate must be
  verified as of the current date via search before any numeric
  calculation is produced — the same discipline the Jurisdiction skill
  applies to rules editions.
- **No silent reuse of the limitation-accrual date as the interest-accrual
  date.** These are answers to two different legal questions even when
  they happen to coincide on the facts — confirm the interest-triggering
  event under the applicable interest provision specifically, rather than
  copying the date used for limitation purposes.

## 4. Process

### Phase 0 — Confirm Contractual Interest Clause

Check the contract for an express interest clause. If one exists, extract
its rate, trigger, and compounding terms into working notes, and check
(sourced) whether it is overridden or capped by any mandatory rule of the
governing law (e.g. a usury ceiling, or a minimum statutory rate that
applies regardless of contractual agreement) — flag any such conflict
rather than assuming the contractual term controls automatically.

### Phase 1 — Determine the Applicable Interest Regime (Commentary Cross-Check Tool)

Where the contract is silent, or only partially covers the interest
question, extract the statutory regime from statute/commentary into an
**Interest Basis Checklist**:

| Element | Source (statute/clause/commentary pinpoint) | Notes |

This should specifically identify **whether more than one statutory
interest doctrine can apply and how they interact** — many systems
distinguish "default interest" (running from a formal demand or default
under a general damages-delay provision) from "proceedings interest"
(running from commencement of litigation/arbitration under a separate
provision), and the relationship between the two (concurrent, the higher
of the two, or mutually exclusive) must be sourced, not assumed.

### Phase 2 — Per-Head Accrual Date Determination

Using the Quantum skill's Heads of Loss Register, determine — separately
for each head — the date interest begins to run **under the specific
interest-triggering rule identified in Phase 0/1**, not by copying the
limitation-accrual or loss-incurred date without checking:

| Head of loss | Candidate accrual trigger(s) | Legal basis (sourced) | Resulting date |

Where more than one plausible trigger exists (e.g. date loss incurred vs.
date of formal demand vs. date arbitration commenced), present them as
candidates with sourced reasoning, the same way the Quantum skill handles
competing limitation-accrual theories — flag for the lawyer's confirmation
rather than choosing silently. Where individual per-head dates aren't
clearly evidenced, identify the sourced fallback trigger (commonly,
commencement of the arbitration) rather than assuming it applies by
default.

### Phase 3 — Rate Determination and Verification

- If the applicable rate is fixed (a specific contractual percentage, or a
  flat statutory rate), record it with its source.
- If the applicable rate is formula-based against a floating reference/
  base rate, **verify the current published reference rate via search**
  before proceeding — do not use a remembered figure, since these rates
  are typically adjusted periodically and a stale figure would misstate
  the claim.
- Note that because interest typically runs "until payment" at an
  unknown future date, pleadings conventionally state the rate mechanism
  (e.g. "the statutory default rate from time to time") rather than lock
  in a single number — reserve a fixed numeric calculation for an
  illustrative exhibit only (Phase 5), clearly labelled as such.
- Determine, sourced, whether compounding is available under the
  applicable regime or clause. Do not assume compound interest applies —
  many statutory default-interest regimes provide simple interest only
  unless the contract or a specific provision says otherwise.

### Phase 4 — End Date and Pre-/Post-Award Interaction

Determine, sourced from the seat's arbitration law and/or the applicable
substantive law, whether:

- interest simply runs "until payment" as a single continuous claim, or
- the seat's law or the applicable rules distinguish **pre-award interest**
  (on the loss up to the date of the award) from **post-award interest**
  (on the award itself, from the award date until payment), which may be
  governed by a different rate or legal basis.

If the two are treated differently, flag that the Statement of Claim may
need to plead for both separately (pre-award interest under the
substantive law, post-award interest under the seat's arbitration law or
institutional rules) rather than treating "until payment" as covering
both by default.

### Phase 5 — Illustrative Calculation (Only If Requested)

If the lawyer wants a numeric interest figure or schedule (e.g. as a
supporting exhibit rather than the pleading text), produce it only after
Phases 1–3 are complete:

| Head of loss | Principal | Rate | Accrual start date | Calculation cut-off date | Compounding treatment | Illustrative interest amount |

Label this clearly as **illustrative, calculated to a stated cut-off date,
and requiring updating to the actual date of payment or award** — never
present it as a final figure. Never produce this table without having
completed the Phase 3 rate verification first.

### Phase 6 — Draft the Section

Short section, calibrated to the reference precedent: state the legal
basis (contractual clause and/or statutory provision(s), sourced),
the accrual logic (per-head dates or a general rule if uniform across
heads, from Phase 2), the rate mechanism (from Phase 3, without
necessarily locking a number), running until payment, and — if Phase 4
identified a pre-/post-award distinction — note it or draft the separate
post-award interest request as appropriate.

### Phase 7 — Verification

**(a) Grounding check.** Every rate, trigger, and compounding statement
traces to a sourced clause, statute, or commentary excerpt.

**(b) Currency check.** If a floating reference rate was used for any
numeric calculation, confirm it was verified via current search in this
session, not recalled.

**(c) Accrual-distinctness check.** Confirm the interest accrual date(s)
were independently determined under the interest-triggering rule, not
copied from the Quantum skill's limitation-accrual analysis without
checking they're the same trigger.

**(d) Pre-/post-award check.** Confirm the Phase 4 determination is
sourced or explicitly flagged as unresolved.

**(e) Compounding check.** Confirm compounding is only claimed where
sourced.

### Phase 8 — Output Package

1. **Clean draft** — the Interest section.
2. **Interest Basis Checklist** (Phase 1).
3. **Per-Head Accrual Determination table** (Phase 2).
4. **Rate Verification note** — source and date verified (Phase 3).
5. **Illustrative Calculation schedule**, if requested (Phase 5), clearly
   labelled.
6. **Flags list** — any contested accrual trigger, any unresolved pre-/
   post-award question, any contractual/statutory rate conflict.

## 5. Guardrails

- Never state an interest rate, formula, or compounding basis without a
  sourced basis.
- Never use a floating reference rate without verifying it currently.
- Never assume the interest-accrual date equals the limitation-accrual
  date without checking they share the same legal trigger.
- Never present an illustrative calculation as a final, fixed figure.
- Never treat pre-award and post-award interest as automatically the same
  question without checking the seat's law.

## 6. Reference Calibration

The reference precedent's Section X — one short paragraph stating the
statutory basis, the accrual logic (per-loss dates, or at the latest from
commencement of the arbitration), and running until payment, with no fixed
number locked in — is the target length and register for the pleading
text itself.
