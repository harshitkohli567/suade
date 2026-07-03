import { SkillRecord } from "@/types";

/**
 * The Skill Registry (Step 4 / FR-4). Built directly from the 11 skill
 * files under ./source/, which are full agentic workflow specs in
 * Claude's native Skill format (YAML frontmatter `name` + `description`
 * for routing, then a structured multi-phase body) -- not short
 * {{variable}} prompt templates. See SkillRecord's doc comments in
 * src/types/index.ts for why the shape changed from the original PRD
 * Section 12 sketch.
 *
 * IMPORTANT, genuinely new discovery from reading the real files (not
 * visible from the CSV's one-line descriptions used to write the PRD):
 * these 11 Skills form a dependency graph, not an independent list.
 * dependsOnSkills below is read directly from each file's own "Required
 * Inputs" section -- e.g. relief-sought's file explicitly requires the
 * outputs of six other Skills.
 *
 * OPEN QUESTION (flagging rather than deciding silently, same discipline
 * as the PRD's Decisions Log): Suade doesn't yet do anything with
 * dependsOnSkills -- no enforcement, no auto-run, no ordering hint in the
 * dropdown. A lawyer can currently run "Relief Sought" before ever
 * running "Causation," and the Skill will just do its best against
 * whatever's actually in the document. Options for a later step: (a)
 * warn in the UI when a Skill's dependencies haven't been run yet, (b)
 * block the run until they have, (c) leave it entirely to the lawyer's
 * judgment (arguably correct, since a lawyer might deliberately draft
 * out of order). Not resolved here -- needs a product decision, not an
 * engineering default.
 *
 * Also newly surfaced: several skills need a "Legal Theory Brief" or
 * "Case Brief" -- lawyer-supplied instructions distinct from both an
 * uploaded document and another Skill's output. Captured in
 * lawyerSuppliedInputs below. There is currently no UI for a lawyer to
 * provide this. Flagged, not solved, in this step.
 */

const OWNER = "Suade (firm default)";
const SEEDED_AT = "2026-07-02T00:00:00Z";

function seed(
  overrides: Omit<
    SkillRecord,
    "scope" | "owner" | "version" | "lastEditedBy" | "lastEditedAt"
  >
): SkillRecord {
  return {
    ...overrides,
    scope: "firm-default",
    owner: OWNER,
    version: 1,
    lastEditedBy: "system-seed",
    lastEditedAt: SEEDED_AT,
  };
}

export const SKILL_REGISTRY: SkillRecord[] = [
  seed({
    skillId: "brief-summary-of-facts",
    displayName: "Brief Summary of Facts",
    description:
      "Draft the persuasive, citation-first chronology that opens Section I -- built from a Document Index and Fact Table, checked against fabrication and omission.",
    sourceFile: "brief-summary-of-facts.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["I"] },
    dependsOnSkills: [],
    requiredDocuments: ["exhibit"],
    lawyerSuppliedInputs: ["Initial Instruction Prompt (Case Brief)"],
    outputSpec: {
      register: "persuasive, short declarative sentences, no adjectives carrying the argument",
      structuralFormat: "5-8 sentence narrative paragraph, matching Section I.2 of the reference precedent",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "main-proposition",
    displayName: "Main Proposition",
    description:
      "Draft the lettered/ordinal roadmap paragraph in Section I stating the core legal grounds, sequenced by logical necessity rather than chronology.",
    sourceFile: "main-proposition.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["I"] },
    dependsOnSkills: ["brief-summary-of-facts"],
    requiredDocuments: [],
    lawyerSuppliedInputs: ["Legal Theory Brief"],
    outputSpec: {
      register: "conclusory, one sentence per proposition, no argument",
      structuralFormat: "ordinal/lettered list (First, Second, Third...), matching the reference precedent's five propositions",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "description-of-parties",
    displayName: "Description of Parties",
    description:
      "Draft Section II -- formal party-identification paragraphs, with identity facts independently verified against corporate source documents before drafting.",
    sourceFile: "description-of-parties.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["II"] },
    dependsOnSkills: ["brief-summary-of-facts"],
    requiredDocuments: ["corporate_registry", "governing_contract"],
    lawyerSuppliedInputs: ["Legal Theory Brief"],
    outputSpec: {
      register: "compact, formal, no argument beyond one sourced descriptive sentence per party",
      structuralFormat: "one short paragraph per party (Claimant then Respondent)",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "jurisdiction-and-applicable-law",
    displayName: "Jurisdiction and Applicable Law",
    description:
      "Draft Section III -- extract the actual arbitration clause, verify the applicable rules edition against the institution's current rules (not recall), and state the applicable substantive law.",
    sourceFile: "jurisdiction-and-applicable-law.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["III"] },
    dependsOnSkills: ["brief-summary-of-facts"],
    requiredDocuments: ["governing_contract"],
    lawyerSuppliedInputs: [],
    outputSpec: {
      register: "two short, confident paragraphs; no hedging once verified",
      structuralFormat: "paragraph 1 = jurisdiction (clause, rules edition, seat, language, contested status); paragraph 2 = applicable law",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "factual-background",
    displayName: "Sequence of Events (Persuasive Chronology)",
    description:
      "Draft Section IV -- the full, numbered, sub-headed chronology that every later legal section cites back to by paragraph number. Hard-requires the Brief Summary of Facts skill's Document Index and Fact Table to already exist.",
    sourceFile: "factual-background.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["IV"] },
    dependsOnSkills: ["brief-summary-of-facts"],
    requiredDocuments: ["exhibit"],
    lawyerSuppliedInputs: ["Legal Theory Brief", "Exhibit numbering convention (if already fixed)"],
    outputSpec: {
      register: "comprehensive over compact -- persuasive through structure and selection, not adjectives",
      structuralFormat: "lettered sub-sections (A, B, C...), numbered paragraphs, pinpoint exhibit citation on every factual assertion",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering; assign sub-headings A, B, C..." },
  }),

  seed({
    skillId: "breach",
    displayName: "Description of the Breach and Legal Provisions",
    description:
      "Draft the Breach section -- element-by-element, with sourced contractual/statutory provisions -- establishing non-conformity only, deliberately excluding causation and quantum.",
    sourceFile: "breach.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["V"] },
    dependsOnSkills: ["main-proposition", "factual-background"],
    requiredDocuments: [],
    lawyerSuppliedInputs: ["Commentary/treatise excerpts (optional)"],
    outputSpec: {
      register: "concise and declarative; proves non-conformity only, not narrative or consequences",
      structuralFormat: "per applicable standard: state standard -> apply elements -> address live disputes -> conclude breach",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "causation",
    displayName: "Explanation That Party's Loss Was Caused by the Other Party",
    description:
      "Draft the Causation section -- a sourced doctrinal test applied element by element, with systematic, evidenced elimination of every plausible alternative cause.",
    sourceFile: "causation.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["VII"] },
    dependsOnSkills: ["factual-background", "breach"],
    requiredDocuments: ["expert_report"],
    lawyerSuppliedInputs: ["Commentary/treatise excerpts on causation (required to source the doctrinal test)"],
    outputSpec: {
      register: "persuasive through evidentiary density and systematic elimination, not adjectives",
      structuralFormat: "state test -> affirmative causal chain -> rebut actual counter-theory -> address other alternatives -> burden of proof -> conclusion",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "quantum-of-loss",
    displayName: "Analysis of Quantum of Loss",
    description:
      "Draft the Quantum of Loss section -- every head of loss screened for limitation and legal recoverability before valuation, methodology ranked by legal soundness first and value only among sound alternatives.",
    sourceFile: "quantum-of-loss.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["IX"] },
    dependsOnSkills: ["causation", "jurisdiction-and-applicable-law"],
    requiredDocuments: ["governing_contract", "exhibit"],
    lawyerSuppliedInputs: ["Legal Theory Brief", "Commentary/treatise excerpts on limitation and damages doctrine (optional)"],
    outputSpec: {
      register: "stated legal basis, then a table; reasoning behind it is working material, not pleading text",
      structuralFormat: "heads-of-loss table (number, head, amount, exhibit source) matching the reference precedent's format, with reservation to update if loss still developing",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering; insert table matching existing table styling" },
  }),

  seed({
    skillId: "interest",
    displayName: "Explanation of Interest Logic",
    description:
      "Draft the Interest section -- legal basis, accrual date per head, and rate mechanism, with any floating reference rate verified via current search, not recalled.",
    sourceFile: "interest.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["X"] },
    dependsOnSkills: ["jurisdiction-and-applicable-law", "quantum-of-loss"],
    requiredDocuments: ["governing_contract"],
    lawyerSuppliedInputs: ["Commentary/treatise excerpts on the applicable interest regime (optional)"],
    outputSpec: {
      register: "short, states basis and accrual logic, no number locked in unless an illustrative exhibit is specifically requested",
      structuralFormat: "single short paragraph, matching Section X of the reference precedent",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "evidence-relied-upon",
    displayName: "Description of the Evidence and Evidentiary Value",
    description:
      "Draft the Evidence Relied Upon section -- a compact filed list, backed by a fuller working evidentiary-value analysis (probative weight, corroboration, vulnerabilities) kept separate from the pleading text.",
    sourceFile: "evidence-relied-upon.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["XII"] },
    dependsOnSkills: ["brief-summary-of-facts", "factual-background", "jurisdiction-and-applicable-law"],
    requiredDocuments: ["witness_statement", "expert_report"],
    lawyerSuppliedInputs: [],
    outputSpec: {
      register: "compact list in the filed text; fuller weight analysis stays as working material unless the lawyer asks for it in the filed text",
      structuralFormat: "short list of named witness statements + exhibit range, with a reservation for anticipated expert evidence",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering" },
  }),

  seed({
    skillId: "relief-sought",
    displayName: "Relief Sought",
    description:
      "Draft the Relief Sought section -- translating conclusions already established elsewhere into specific declarations and orders, with every relief type checked against the seat's arbitration law before being requested.",
    sourceFile: "relief-sought.md",
    trigger: { documentTypes: ["statement_of_claim"], sections: ["XIII"] },
    dependsOnSkills: [
      "main-proposition",
      "breach",
      "causation",
      "quantum-of-loss",
      "interest",
      "jurisdiction-and-applicable-law",
    ],
    requiredDocuments: [],
    lawyerSuppliedInputs: ["Legal Theory Brief (for remedy preference where more than one is legally available)"],
    outputSpec: {
      register: "integration section -- establishes nothing new, translates prior conclusions into requests",
      structuralFormat: "lettered list (a)-(f): declarations, monetary relief, interest, costs, catch-all, closed by reservation to amend",
    },
    insertionRule: { anchor: "section_end", numberingBehaviour: "continue existing ListParagraph numbering; use lettered sub-list matching reference precedent" },
  }),
];

export function getSkillById(skillId: string): SkillRecord | undefined {
  return SKILL_REGISTRY.find((skill) => skill.skillId === skillId);
}

export function getSkillsForSection(sectionId: string): SkillRecord[] {
  return SKILL_REGISTRY.filter((skill) => skill.trigger.sections.includes(sectionId));
}
