import { DocTypeInfo, ReferenceInfo } from "../api";

/**
 * Minimalist "provenance graph" shown above the skill list on the draft step.
 * Its job is trust: at a glance, show that a draft isn't one generic prompt —
 * it's assembled by a sequence of dedicated section Skills, each grounded in
 * Suade's reference protocols and domain knowledge, over the lawyer's own
 * documents. Driven entirely by real data from /api/webapp/doc-types, so it
 * stays honest and grows as reference files are added.
 */

interface Props {
  docType: DocTypeInfo;
  documentCount?: number;
}

const KIND_LABEL: Record<string, string> = {
  protocol: "Protocol",
  knowledge: "Domain knowledge",
  structure: "Structure guide",
  reference: "Reference",
};

// Flatten every skill's references into a de-duplicated list, remembering
// which skills each one powers (for the tooltip).
function collectReferences(docType: DocTypeInfo): (ReferenceInfo & { owners: string[] })[] {
  const byName = new Map<string, ReferenceInfo & { owners: string[] }>();
  for (const skill of docType.skills) {
    for (const ref of skill.references || []) {
      const existing = byName.get(ref.name);
      if (existing) existing.owners.push(skill.label);
      else byName.set(ref.name, { ...ref, owners: [skill.label] });
    }
  }
  return [...byName.values()];
}

export default function SkillGraph({ docType, documentCount }: Props) {
  const refs = collectReferences(docType);
  const kinds = Array.from(new Set(refs.map((r) => r.kind)));

  return (
    <section className="provenance" aria-label="How this draft is assembled">
      <div className="prov-head">
        <span className="prov-title">How this draft is assembled</span>
        <span className="prov-stats">
          <b>{docType.skills.length}</b> expert skills
          {refs.length > 0 && (
            <>
              {" · "}
              <b>{refs.length}</b> reference file{refs.length === 1 ? "" : "s"}
            </>
          )}
          {documentCount ? (
            <>
              {" · grounded in "}
              <b>{documentCount.toLocaleString()}</b> documents
            </>
          ) : null}
        </span>
      </div>

      {/* The assembly rail: each skill is a node on one continuous line, in
          drafting order, ending in the two-channel output. */}
      <div className="prov-rail" role="list">
        {docType.skills.map((s, i) => (
          <div key={s.id} className={`rail-node ${i === 0 ? "first" : ""}`} role="listitem" title={s.label}>
            <span className="rail-dot" />
            <span className="rail-tip">{s.label}</span>
          </div>
        ))}
        <span className="rail-arrow" aria-hidden="true">
          →
        </span>
        <div className="rail-out" title="Two-channel output">
          <span>Draft</span>
          <span>Working notes</span>
        </div>
      </div>

      {refs.length > 0 && (
        <>
          <div className="prov-join" aria-hidden="true" />
          <div className="prov-refs">
            <div className="refs-label">Reference files these skills draw on</div>
            <div className="refs-chips">
              {refs.map((r) => (
                <span
                  key={r.name}
                  className={`refchip ${r.kind}`}
                  title={`${KIND_LABEL[r.kind] || "Reference"} · used by ${r.owners.join(", ")}`}
                >
                  <span className="refchip-dot" />
                  {r.label}
                </span>
              ))}
            </div>
            {kinds.length > 0 && (
              <div className="refs-legend">
                {kinds.map((k) => (
                  <span key={k} className="legend-item">
                    <span className={`refchip-dot ${k}`} />
                    {KIND_LABEL[k] || k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <p className="prov-caption">
        Every section is drafted by its own dedicated skill — grounded in Suade&apos;s arbitration
        protocols and domain knowledge, with each claim traceable to your documents.
      </p>
    </section>
  );
}
