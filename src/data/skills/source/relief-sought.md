---
name: relief-sought
description: >
  Use this skill to draft the Relief Sought (prayer for relief) section of
  a Statement of Claim — translating the conclusions already established
  in the Main Proposition, Breach, Causation, Quantum, and Interest
  sections into the specific declarations and orders requested from the
  Tribunal. Trigger this skill whenever the lawyer asks to draft the
  relief sought, the prayer for relief, or what should be requested from
  the Tribunal. This skill must always be used instead of drafting this
  section freehand — every relief item must trace back to something
  actually established elsewhere in the document, every monetary figure
  must reconcile exactly with the Quantum section, and every relief type
  must be checked against the seat's arbitration law before being
  requested, since not everything a client might want (e.g. in rem
  orders, punitive damages, equitable remedies) is necessarily something
  an arbitral tribunal has the power to grant.
---

# Skill: Relief Sought

## 1. Purpose

This is the integration section. It doesn't establish anything new — it
takes what the rest of the Statement of Claim has already proven and
translates it into a precise list of what is being asked of the Tribunal.
The two failure modes to guard against are: **drift** (a relief item that
doesn't quite match what was actually established, or a monetary figure
that's gone stale relative to the Quantum section) and **overreach**
(requesting a remedy the tribunal may not have the power to grant at all,
or claiming more than what was actually pleaded and proven elsewhere).

## 2. Required Inputs

1. **Main Proposition Elements Table**, for the full list of legal
   conclusions the Statement of Claim is built to establish.
2. **Breach and Causation sections**, for the specific findings (breach,
   valid exercise of a contractual remedy such as termination, etc.) that
   need a corresponding declaration.
3. **Quantum of Loss section**, for the final, reconciled damages figure —
   reused exactly, never independently restated.
4. **Interest section**, for the determined basis and accrual logic — reused,
   not reinvented.
5. **Jurisdiction and Applicable Law section**, for the seat's arbitration
   law and the institutional rules' provisions on costs and on what
   relief a tribunal seated there has the power to grant.
6. **Liability Cap section, if drafted separately**, for any constraint on
   the monetary relief that can be requested.
7. **Legal Theory Brief**, specifically for the client's actual remedy
   preference where more than one legally available remedy could address
   the same wrong (e.g. damages versus specific performance) — this is a
   client-instruction question, not something this skill should assume.

## 3. Non-Negotiable Rules

- **No invented relief-type availability.** Whether a tribunal at this
  seat, under these rules, can grant a particular type of relief (a
  declaration, damages, specific performance, an injunction, costs) must
  be sourced from the seat's arbitration law or the institutional rules —
  never assumed available by default, and never assumed unavailable
  without checking either.
- **No relief item without an upstream source.** Every declaration or
  order requested must trace to a specific finding already established in
  another section. This skill does not create new claims.
- **No independently restated monetary figures.** The damages amount
  requested must be pulled directly from the Quantum section's final
  total; the interest formulation must be pulled directly from the
  Interest section's determined basis. Neither is redrafted from scratch
  here.

## 4. Process

### Phase 0 — Gather Upstream Conclusions

Pull, without modification:

- Every proposition from the Main Proposition Elements Table.
- Every conclusion from the Breach and Causation sections (breach
  findings, valid exercise of any contractual remedy such as termination).
- The final heads-of-loss table and total from the Quantum section.
- The determined interest basis from the Interest section.
- Any relief-relevant constraint from a Liability Cap section, if one
  exists.

### Phase 1 — Build the Relief Candidate Register

For each item gathered in Phase 0, draft a candidate relief item:

| Source (section/proposition) | Candidate relief wording | Type (declaratory / monetary / other) | Legal basis |

### Phase 2 — Relief-Type Availability Screening

For each candidate, confirm — sourced from the seat's arbitration law
and/or institutional rules, not assumed — that a tribunal seated here has
the power to grant that type of relief. Specifically check for:

- **In rem character.** Any relief that would affect title, status, or
  bind persons who are not parties to the arbitration is likely outside
  an arbitral tribunal's power in most systems, which are generally
  limited to in personam relief between the parties. Flag any candidate
  with this character rather than including it by default.
- **Punitive or exemplary damages.** Many systems treat these as contrary
  to public policy or simply unavailable in a contract damages claim;
  check the applicable substantive law and the seat's law before including
  any relief framed this way.
- **Equitable/injunctive relief** (specific performance, injunction).
  Check both legal availability under the applicable law and any
  contractual restriction (e.g. an exclusive-remedy-in-damages clause)
  that might exclude it.
- **Declaratory relief.** Generally available, but confirm no specific
  restriction applies.
- **Interim/provisional measures.** These are typically obtained through a
  separate procedural mechanism (an interim measures application or
  emergency arbitrator process), not through the final prayer for relief —
  flag and exclude if a candidate is actually an interim-measures request
  mistakenly framed as final relief.

Output: | Candidate relief | Type | Availability determination
(`Available` / `Restricted — [reason]` / `Flag for counsel`) | Source |.
Anything not `Available` does not proceed into the draft without either
resolution or explicit escalation to the lawyer.

### Phase 3 — Cross-Consistency Check (Forward and Reverse)

**(a) Forward.** Every proposition in the Main Proposition Elements Table
and every conclusion in the Breach/Causation sections has a corresponding
relief item. A proven finding with no corresponding relief request is a
gap — the Statement of Claim would be proving something it isn't actually
asking the Tribunal to act on.

**(b) Reverse.** Every candidate relief item traces back to an actual
finding established elsewhere in the document. A relief item with no
upstream source is overreach — flag and remove it, or flag it for the
lawyer to confirm whether an upstream section needs to be extended to
support it.

### Phase 4 — Monetary, Interest, and Costs Reconciliation

- **Damages figure**: pulled exactly from the Quantum section's final
  total — not recalculated, not rounded, not restated independently. If
  Quantum reserved the right to update the figure (e.g. an ongoing
  recall), mirror that reservation here rather than presenting a fixed
  number as final.
- **Interest**: wording mirrors the Interest section's sourced basis and
  accrual logic exactly — do not draft a new interest formulation here.
- **Costs**: request that the Respondent bear the costs of the
  arbitration, referencing the sourced cost-allocation provision from the
  institutional rules (via the Jurisdiction and Applicable Law section).
  Do not quantify costs here — that is a separate, later exercise (a
  dedicated Costs submission/skill); this section only states the request
  in principle.

### Phase 5 — Remedy Preference Confirmation

Where more than one legally available remedy could address the same
finding (e.g. damages versus specific performance, or alternative framings
of a declaration), do not assume which the client wants. Flag it and
confirm with the lawyer — this is an instruction question, not a legal
derivation this skill should make unilaterally.

### Phase 6 — Draft the Section

Lettered/ordinal list, calibrated to the reference precedent:

(a) Declaratory relief — breach findings, tracing to the Breach section
and its statutory/contractual basis.
(b) Declaratory relief — valid exercise of any contractual remedy (e.g.
termination), if applicable, tracing to the relevant section.
(c) Monetary relief — damages in the exact amount from Quantum, "or such
other amount as the Tribunal shall determine."
(d) Interest — per the Interest section's sourced basis.
(e) Costs — Respondent to bear the costs of the arbitration, per the
sourced cost-allocation provision.
(f) Catch-all — such further or other relief as the Tribunal considers
appropriate (standard practice; include unless there's a specific reason
not to).

Close with a reservation of the right to amend and supplement the
Statement of Claim, including in reply to any Statement of Defence or
counterclaim, as in the reference precedent.

### Phase 7 — Verification

**(a) Grounding check.** Every relief item traces to a Phase 0 upstream
source.

**(b) Availability check.** Every relief item in the draft has a Phase 2
status of `Available`; nothing `Restricted` or unresolved-`Flagged`
appears without explicit lawyer sign-off logged.

**(c) Forward/reverse consistency check.** Phase 3(a) and 3(b) both fully
resolved — no proven finding unclaimed, no relief item unsupported.

**(d) Monetary reconciliation check.** The damages figure, interest
formulation, and costs request match their source sections exactly, with
no independent restatement or drift.

**(e) In personam / in rem final screen.** A last, explicit pass over the
full draft confirming no relief item has in rem character or purports to
bind non-parties.

### Phase 8 — Output Package

1. **Clean draft** — the Relief Sought section.
2. **Relief Candidate Register** (Phase 1).
3. **Relief-Type Availability Table** (Phase 2).
4. **Cross-Consistency Report** — forward and reverse (Phase 3).
5. **Monetary/Interest/Costs Reconciliation note** (Phase 4).
6. **Remedy Preference Flags** (Phase 5).
7. **Gap/Flags Report** — anything restricted, unresolved, or requiring
   lawyer confirmation before filing.

## 5. Guardrails

- Never assume a relief type is available to an arbitral tribunal without
  sourcing it against the seat's law and the institutional rules.
- Never include a relief item with in rem character or effect against
  non-parties without flagging it prominently.
- Never restate the damages figure or interest basis independently of
  their source sections — pull them exactly.
- Never claim relief beyond what the rest of the document actually
  establishes, and never leave an established finding without a
  corresponding relief request.
- Never assume the client's remedy preference where more than one legally
  available option exists — confirm it.

## 6. Reference Calibration

The reference precedent's Section XIII — six lettered items moving from
declaratory relief (breach, valid termination) through monetary relief
(exact quantum figure, with a fallback to "such other amount as the
Tribunal shall determine"), interest, costs, and a catch-all, closed by a
reservation of the right to amend — is the target structure and register.
