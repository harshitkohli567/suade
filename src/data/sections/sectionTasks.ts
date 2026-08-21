import { DocumentRole, SkillRecord } from "@/types";
import { SKILL_REGISTRY } from "@/data/skills/registry";

/**
 * Per-section detection config for the task-pane "Task Detected / Context
 * Assembled" card. When the cursor lands in a document section, Suade uses
 * this table to auto-populate the Task / Goal / Assumptions fields and the
 * pre-selected Skills, then lets the lawyer edit and confirm each field.
 *
 * These are deterministic, editable DEFAULTS (config-table approach, chosen
 * over a live model call) -- concise by design. Sources are NOT hard-coded
 * here: they are DERIVED from the primary drafting Skill's own declared
 * inputs (see deriveDetectedContext) --
 *   - requiredDocuments -> upload-type sources (e.g. Governing Contract)
 *   - dependsOnSkills    -> previously-drafted sections, read from the
 *                           document directly rather than re-uploaded
 * The forthcoming per-section Sources table (product-supplied) will layer in
 * as an override here; until then the registry derivation is the source list.
 */

// ---------------------------------------------------------------------------
// Skill library for the combobox: the 11 drafting Skills + formatting Skills.
// ---------------------------------------------------------------------------

export type SkillKind = "drafting" | "formatting";

export interface SkillLibraryItem {
  skillId: string;
  displayName: string;
  kind: SkillKind;
  description?: string;
}

/**
 * Formatting/utility Skills shown alongside the drafting Skills (e.g.
 * "Paragraphs", "Headings" in the mock). These are placeholders: their real
 * specs/behaviour are product-supplied and not yet modeled as run-able Skills,
 * so today they act as context tags, not as things the run executes.
 */
export const FORMATTING_SKILLS: SkillLibraryItem[] = [
  { skillId: "paragraphs", displayName: "Paragraphs", kind: "formatting" },
  { skillId: "headings", displayName: "Headings", kind: "formatting" },
];

/** Everything the Skills combobox can filter over. */
export const SKILL_LIBRARY: SkillLibraryItem[] = [
  ...SKILL_REGISTRY.map((s) => ({
    skillId: s.skillId,
    displayName: s.displayName,
    kind: "drafting" as const,
    description: s.description,
  })),
  ...FORMATTING_SKILLS,
];

const DRAFTING_SKILL_IDS = new Set(SKILL_REGISTRY.map((s) => s.skillId));

export function isDraftingSkill(skillId: string): boolean {
  return DRAFTING_SKILL_IDS.has(skillId);
}

export function skillDisplayName(skillId: string): string {
  return SKILL_LIBRARY.find((s) => s.skillId === skillId)?.displayName ?? skillId;
}

// ---------------------------------------------------------------------------
// Per-section task spec (Task / Goal / Assumptions + pre-selected Skills).
// ---------------------------------------------------------------------------

export interface SectionTaskSpec {
  /** A few concise words: what to do in this section. */
  task: string;
  /** A few concise words: the section's objective. */
  goal: string;
  /** Standing assumptions for the draft; "None" when there are none. */
  assumptions: string;
  /** Skills pre-selected for the section (drafting first, then formatting). */
  skillIds: string[];
  /**
   * Authoritative source inputs for the section, from the product-supplied
   * per-section Sources table. Overrides the registry-derived default.
   */
  sources: string;
}

/**
 * Keyed by DocumentSection.sectionId (roman numerals I..XIII). Sections with
 * no drafting Skill (VI, VIII, XI) are intentionally absent -- the card falls
 * back to generic defaults derived from the section title.
 */
export const SECTION_TASKS: Record<string, SectionTaskSpec> = {
  I: {
    task: "Draft summary of facts",
    goal: "Frame the dispute",
    assumptions: "None",
    skillIds: ["brief-summary-of-facts", "paragraphs"],
    sources: "Exhibits, Witness Statements, Governing Contract",
  },
  II: {
    task: "Draft description of parties",
    goal: "Identify the parties",
    assumptions: "None",
    skillIds: ["description-of-parties", "paragraphs", "headings"],
    sources: "Governing Contract, Corporate Registry",
  },
  III: {
    task: "Draft jurisdiction section",
    goal: "Determine applicable rules",
    assumptions: "None",
    skillIds: ["jurisdiction-and-applicable-law", "paragraphs", "headings"],
    sources: "Governing Contract",
  },
  IV: {
    task: "Draft factual background",
    goal: "Build the chronology",
    assumptions: "None",
    skillIds: ["factual-background", "paragraphs"],
    sources: "Exhibits, Witness Statements, Governing Contract, Expert Reports",
  },
  V: {
    task: "Draft the breach",
    goal: "Establish the breach",
    assumptions: "None",
    skillIds: ["breach", "paragraphs"],
    sources: "Exhibits, Witness Statements, Governing Contract",
  },
  VII: {
    task: "Draft causation",
    goal: "Link breach to loss",
    assumptions: "None",
    skillIds: ["causation", "paragraphs"],
    sources: "Legal Commentary, Treatise",
  },
  IX: {
    task: "Draft quantum of loss",
    goal: "Quantify the loss",
    assumptions: "None",
    skillIds: ["quantum-of-loss", "paragraphs"],
    sources: "Governing Contract, Legal Commentary, Industry Guidance",
  },
  X: {
    task: "Draft interest",
    goal: "Set out the interest logic",
    assumptions: "None",
    skillIds: ["interest", "paragraphs"],
    sources: "Governing Contract, Commentary, Treatise",
  },
  XII: {
    task: "Draft evidence relied upon",
    goal: "Marshal the evidence",
    assumptions: "None",
    skillIds: ["evidence-relied-upon", "paragraphs"],
    sources: "Witness Statement, Expert Reports, Document Index, Fact Table",
  },
  XIII: {
    task: "Draft relief sought",
    goal: "State the relief",
    assumptions: "None",
    skillIds: ["relief-sought", "paragraphs"],
    sources: "Legal Theory Brief, Fact Table",
  },
};

// ---------------------------------------------------------------------------
// Derivation: section -> the assembled context the card renders.
// ---------------------------------------------------------------------------

/** A source input the section needs that is a previously-drafted document section. */
export interface DocumentSectionSource {
  /** The drafting Skill that produces it (dependency). */
  skillId: string;
  /** The section id where that output lives, e.g. "I". */
  sectionId: string;
  displayName: string;
}

export interface DetectedContext {
  sectionId: string;
  sectionTitle: string;
  task: string;
  goal: string;
  assumptions: string;
  /** Authoritative source inputs (per-section Sources table), as a few words. */
  sources: string;
  /** Pre-selected skills (drafting + formatting), in display order. */
  skillIds: string[];
  /** First drafting skill -- what the run actually executes. */
  primarySkillId: string | null;
  /** Upload-type sources this section needs (from the primary skill). */
  requiredDocumentRoles: DocumentRole[];
  /** Previously-drafted sections available from the document (no upload). */
  documentSectionSources: DocumentSectionSource[];
}

/** Turn a human role token ("governing_contract") into a few words ("Governing Contract"). */
export function humanizeRole(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function deriveDetectedContext(
  section: { sectionId: string; title: string } | null
): DetectedContext | null {
  if (!section) return null;
  const spec = SECTION_TASKS[section.sectionId];

  // Primary drafting skill: first configured drafting skill, else the skill
  // whose trigger names this section.
  const configuredDrafting = (spec?.skillIds ?? []).find((id) => isDraftingSkill(id));
  const primary: SkillRecord | undefined =
    (configuredDrafting && SKILL_REGISTRY.find((s) => s.skillId === configuredDrafting)) ||
    SKILL_REGISTRY.find((s) => s.trigger.sections.includes(section.sectionId));

  const skillIds =
    spec?.skillIds && spec.skillIds.length > 0
      ? spec.skillIds
      : primary
        ? [primary.skillId]
        : [];

  const documentSectionSources: DocumentSectionSource[] = primary
    ? primary.dependsOnSkills.flatMap((depId) => {
        const dep = SKILL_REGISTRY.find((s) => s.skillId === depId);
        if (!dep) return [];
        return dep.trigger.sections.map((secId) => ({
          skillId: dep.skillId,
          sectionId: secId,
          displayName: dep.displayName,
        }));
      })
    : [];

  return {
    sectionId: section.sectionId,
    sectionTitle: section.title,
    task: spec?.task ?? `Draft ${section.title.toLowerCase()}`,
    goal: spec?.goal ?? "",
    assumptions: spec?.assumptions ?? "None",
    sources:
      spec?.sources ??
      (primary && primary.requiredDocuments.length > 0
        ? primary.requiredDocuments.map(humanizeRole).join(", ")
        : "None"),
    skillIds,
    primarySkillId: primary ? primary.skillId : null,
    requiredDocumentRoles: primary ? primary.requiredDocuments : [],
    documentSectionSources,
  };
}
