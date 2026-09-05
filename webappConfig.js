/**
 * Shared configuration for the Suade web workspace (suadelaw.com/app).
 *
 * Single source of truth for:
 *  - the arbitration document types a lawyer can generate, and
 *  - the ordered Skill sequence each one runs.
 *
 * The web app fetches this via GET /api/webapp/doc-types so the client's
 * "skills being used, in sequence" visualization and the server's actual
 * generation loop can never drift apart.
 *
 * v1 note: the firm Skill library today is the Statement-of-Claim section
 * set. Statement of Claim therefore generates in full; the other document
 * types reuse sensible SUBSETS of those same Skills as an approximation
 * until each gets its own bespoke Skills. `approximate: true` marks those
 * so the UI can label them honestly.
 */

// Skill IDs correspond to the firm Skill files resolved by the server
// (src/data/skills/source/**/<skillId>.md). Order below is pleading order.
const SKILL_LABELS = {
  "description-of-parties": "Description of Parties",
  "brief-summary-of-facts": "Brief Summary of Facts",
  "jurisdiction-and-applicable-law": "Jurisdiction & Applicable Law",
  "factual-background": "Factual Background",
  "main-proposition": "Main Proposition",
  breach: "Breach",
  causation: "Causation",
  "quantum-of-loss": "Quantum of Loss",
  interest: "Interest",
  "evidence-relied-upon": "Evidence Relied Upon",
  "relief-sought": "Relief Sought",
};

const STATEMENT_OF_CLAIM_SEQUENCE = [
  "description-of-parties",
  "brief-summary-of-facts",
  "jurisdiction-and-applicable-law",
  "factual-background",
  "main-proposition",
  "breach",
  "causation",
  "quantum-of-loss",
  "interest",
  "evidence-relied-upon",
  "relief-sought",
];

// Rough wall-clock budget per Skill run (grounded, two-channel, adaptive
// thinking). Used only to show the lawyer an up-front estimate; the real
// run reports actual progress as each Skill completes.
const SECONDS_PER_SKILL = 80;

const DOCUMENT_TYPES = [
  {
    id: "request-for-arbitration",
    label: "Request for Arbitration",
    approximate: true,
    skills: [
      "description-of-parties",
      "brief-summary-of-facts",
      "jurisdiction-and-applicable-law",
      "main-proposition",
      "relief-sought",
    ],
  },
  {
    id: "statement-of-claim",
    label: "Statement of Claim",
    approximate: false,
    skills: STATEMENT_OF_CLAIM_SEQUENCE,
  },
  {
    id: "statement-of-defense-and-counterclaim",
    label: "Statement of Defense and Counterclaim",
    approximate: true,
    skills: [
      "description-of-parties",
      "jurisdiction-and-applicable-law",
      "factual-background",
      "main-proposition",
      "breach",
      "causation",
      "quantum-of-loss",
      "relief-sought",
    ],
  },
  {
    id: "statement-of-reply",
    label: "Statement of Reply",
    approximate: true,
    skills: ["brief-summary-of-facts", "factual-background", "main-proposition", "causation", "relief-sought"],
  },
  {
    id: "statement-of-rejoinder",
    label: "Statement of Rejoinder",
    approximate: true,
    skills: ["brief-summary-of-facts", "factual-background", "breach", "causation", "relief-sought"],
  },
  {
    id: "witness-statement",
    label: "Witness Statement",
    approximate: true,
    skills: ["brief-summary-of-facts", "factual-background", "evidence-relied-upon"],
  },
];

// The six categories the document classifier sorts uploads into.
const DOCUMENT_CATEGORIES = [
  { id: "contracts", label: "Contracts", plural: "contracts" },
  { id: "pleadings", label: "Pleadings", plural: "pleadings" },
  { id: "exhibits", label: "Exhibits", plural: "exhibits" },
  { id: "witness-statements", label: "Witness Statements", plural: "witness statements" },
  { id: "affidavits", label: "Affidavits", plural: "affidavits" },
  { id: "corporate-registry", label: "Corporate Registry", plural: "corporate registries" },
];

function getDocumentType(docTypeId) {
  return DOCUMENT_TYPES.find((d) => d.id === docTypeId) || null;
}

/** Public shape sent to the client: labels + estimate baked in. */
function docTypesForClient() {
  return DOCUMENT_TYPES.map((d) => ({
    id: d.id,
    label: d.label,
    approximate: d.approximate,
    skills: d.skills.map((id) => ({ id, label: SKILL_LABELS[id] || id })),
    estimateSeconds: d.skills.length * SECONDS_PER_SKILL,
  }));
}

module.exports = {
  SKILL_LABELS,
  SECONDS_PER_SKILL,
  DOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  getDocumentType,
  docTypesForClient,
};
