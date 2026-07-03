---
name: description-of-parties
description: >
  Use this skill to draft Section II (The Parties) of a Statement of Claim
  in an arbitration — the short paragraphs formally identifying the
  Claimant and Respondent (legal name, entity type, jurisdiction of
  incorporation, registration details, registered address, and a brief
  description of each party's business/role relevant to the dispute).
  Trigger this skill whenever the lawyer asks to draft, check, or verify
  the "Parties" section, party identification, corporate details of the
  claimant/respondent, or standing/capacity of a party to an arbitration.
  This skill must always be used instead of freehand drafting of this
  section — misidentifying a party is an enforcement risk for any
  resulting award, so identity facts must be independently verified
  against corporate source documents before drafting.
---

# Skill: Description of Parties

## 1. Purpose

Produce the formal party-identification paragraphs of the Statement of
Claim, and — because this section is short but carries outsized
downstream risk — verify, before drafting, that each party is correctly
and currently identified in a way that will hold up on enforcement.

This section looks simple (two or three sentences per party, as in the
reference precedent), which is precisely why errors slip through: a wrong
registration number, an outdated registered address, or a claimant that is
technically not the same legal entity as the original contracting party
can undermine standing or the enforceability of any award. Treat identity
verification, not prose quality, as the primary task of this skill.

## 2. Required Inputs

1. **Corporate identity source documents** for each party — certificate of
   incorporation, commercial/companies register extract, or equivalent
   official record. Letterhead and correspondence are useful corroboration
   but are not a substitute for a registry-level source.
2. **The underlying contract** (recitals and signature block), since the
   arbitration agreement's jurisdiction typically runs to the named
   contracting parties — any mismatch between the contracting party and
   the current claimant/respondent needs to be caught here, not later.
3. **Output of the Brief Summary of Facts skill**, which may already
   contain extracted identity facts with citations — reuse those Fact IDs
   rather than re-deriving them from scratch.
4. **The Legal Theory Brief**, to confirm exactly who is being named as
   Claimant(s) and Respondent(s) — including whether there are multiple
   claimants, multiple respondents, or any party the lawyer is considering
   joining who is not a signatory to the arbitration agreement.

## 3. Non-Negotiable Rule: No Invented Identity Facts

**Never fill in a registration number, registered address, jurisdiction of
incorporation, or entity type that is not sourced to a document provided.**
Where information is missing, the correct output is a flag, not a
plausible-sounding placeholder. This applies even to details that seem
minor (e.g. the exact form of a company suffix — GmbH vs. GmbH & Co. KG,
S.p.A. vs. S.r.l.) — these distinctions are legally significant and must
come from the source, not be normalised or guessed.

## 4. Process

### Phase 0 — Build the Party Identity Table

For each party, one row per required field:

| Party | Field | Value | Source (Doc ID + pinpoint) | Status |

Required fields: full legal name, entity type/suffix, jurisdiction of
incorporation, registry name, registration number, registered office
address, and the short defined term to be used throughout the Statement of
Claim (e.g. "Helios," "Castor").

`Status` is one of: `Confirmed from registry extract`, `Confirmed from
contract only — registry extract not provided`, `Missing — flag`.

### Phase 1 — Chain-of-Title / Capacity Check

Compare the party named in the contract's signature block against the
party named in the registry extract and against the party now instructing
counsel as Claimant (or facing the claim as Respondent):

- If the names match exactly, proceed.
- If there is any difference — a name change, merger, demerger,
  assignment of the contract, change of registered address or
  registration number, or a group-company substitution — **do not
  silently reconcile it.** Record the discrepancy and flag it: this is
  precisely the kind of gap that can support a jurisdictional or standing
  challenge from the other side, and the lawyer needs to see it explicitly
  rather than have it smoothed over in the draft.
- If the entity now instructing is not the entity named in the arbitration
  agreement (e.g. a corporate successor relying on universal succession,
  or an assignee), flag this as a **standing/jurisdiction issue requiring
  the lawyer's own analysis** — this skill identifies the discrepancy, it
  does not resolve whether jurisdiction nonetheless exists.

### Phase 2 — Cross-Document Consistency Check

Where a party's details appear in more than one source document
(registry extract, contract, correspondence letterhead, invoices), check
them against each other and flag any inconsistency (e.g. an old address on
early correspondence vs. a current registry address, minor spelling
variants, a VAT/tax ID that appears differently across documents). List
every inconsistency found — do not pick the "most likely correct" version
silently.

### Phase 3 — Defined Terms Consistency

Confirm the short defined term used for each party matches what was
already established in the Brief Summary of Facts and Main Proposition
outputs for this matter. If this is the first skill run for the matter,
this skill's output sets the defined terms going forward — note that
explicitly so downstream skills can reuse them.

### Phase 4 — Draft the Parties Section

One paragraph per party, in the order Claimant then Respondent (or as the
case caption requires). Structure, calibrated to the reference precedent:

1. Full legal name (bold), entity type, and jurisdiction of incorporation.
2. Registration details: registry name, registration number, registered
   office address.
3. The defined term being adopted (e.g. `("Claimant" / "Helios")`).
4. One short, factual sentence on the party's business and its relevance
   to the dispute (e.g. "is the OEM of the *eVolt 3.5*..." /
   "held itself out to [Claimant] as an experienced automotive-grade
   ... supplier"). This sentence may do quiet persuasive work — the
   reference precedent's description of the Respondent as holding itself
   out as an experienced supplier foreshadows a reliance argument made
   later — but it must still be a sourced factual statement, not an
   unsourced characterization. Cite the Fact ID or source document it
   comes from.

Keep to the register of the precedent: compact, formal, no argument beyond
what a single descriptive sentence can carry.

### Phase 5 — Verification

**(a) Grounding check.** Every identity fact in the draft traces to a row
in the Party Identity Table with `Status: Confirmed`. Anything drafted
from a `Missing — flag` row is not permitted — resolve or flag before
finalising, never draft around a gap with a placeholder.

**(b) Completeness check.** Confirm all required fields (Phase 0) are
present for every party. List any still missing.

**(c) Standing/jurisdiction flag.** Surface, as a standalone flag (not
buried in prose), any chain-of-title, capacity, or non-signatory issue
identified in Phase 1 — these affect the Tribunal's jurisdiction and
deserve the lawyer's direct attention before filing.

### Phase 6 — Output Package

1. **Clean draft** — the Parties section paragraphs, ready for Section II.
2. **Party Identity Table** — full working table with sources and statuses.
3. **Flags list** — missing fields, cross-document inconsistencies, and
   any chain-of-title/standing issues from Phase 1(c).

## 5. Guardrails

- Never invent or normalise a registration number, address, or entity
  suffix.
- Never assume legal continuity between the contracting party and the
  current claimant/respondent without a sourced basis — flag instead.
- Never let a "business description" sentence carry an unsourced
  characterization, even a favourable one.
- Keep each party's paragraph to the same register and length as the
  reference precedent — this section stays brief by design; it is not the
  place for the factual narrative (that belongs to the Brief Summary of
  Facts / Factual Background skills).
- Reuse, don't redefine, short-form defined terms already fixed elsewhere
  in the matter.

## 6. Reference Calibration

The reference precedent's Section II — two short paragraphs, each naming
entity type, registry, registration number, registered address, defined
term, and one sourced descriptive sentence — is the target length, density,
and tone.
