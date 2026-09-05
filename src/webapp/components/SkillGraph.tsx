import { DocTypeInfo, GenStep, ReferenceInfo } from "../api";

/**
 * Minimalist "provenance graph": at a glance it shows a draft isn't one
 * generic prompt — it's assembled by a sequence of dedicated section Skills,
 * each grounded in Suade's reference protocols and domain knowledge, over the
 * lawyer's own documents.
 *
 * Two modes:
 *  - preview (no `steps`): the plan, shown on the draft step before running.
 *  - live (`steps` provided): the same graph, but the rail nodes reflect each
 *    skill's real-time status and the currently-drafting skill's reference
 *    files light up — so a lawyer literally watches which skills run, in
 *    sequence, and what each one draws on.
 *
 * Driven entirely by real data from /api/webapp/doc-types, so it stays honest
 * and grows as reference files are added.
 */

interface Props {
  docType: DocTypeInfo;
  documentCount?: number;
  steps?: GenStep[];
}

const KIND_LABEL: Record<string, string> = {
  protocol: "Protocol",
  knowledge: "Domain knowledge",
  structure: "Structure guide",
  reference: "Reference",
};

type RefWithOwners = ReferenceInfo & { ownerIds: string[]; ownerLabels: string[] };

// Flatten every skill's references into a de-duplicated list, remembering
// which skills each one powers (for the tooltip + live highlight).
function collectReferences(docType: DocTypeInfo): RefWithOwners[] {
  const byName = new Map<string, RefWithOwners>();
  for (const skill of docType.skills) {
    for (const ref of skill.references || []) {
      const existing = byName.get(ref.name);
      if (existing) {
        existing.ownerIds.push(skill.id);
        existing.ownerLabels.push(skill.label);
      } else {
        byName.set(ref.name, { ...ref, ownerIds: [skill.id], ownerLabels: [skill.label] });
      }
    }
  }
  return [...byName.values()];
}

export default function SkillGraph({ docType, documentCount, steps }: Props) {
  const refs = collectReferences(docType);
  const kinds = Array.from(new Set(refs.map((r) => r.kind)));

  const live = Boolean(steps && steps.length);
  const statusById: Record<string, GenStep["status"]> = {};
  for (const s of steps || []) statusById[s.skillId] = s.status;
  const runningIds = new Set((steps || []).filter((s) => s.status === "running").map((s) => s.skillId));
  const doneCount = (steps || []).filter((s) => s.status === "done").length;
  const refActive = (r: RefWithOwners) => r.ownerIds.some((id) => runningIds.has(id));

  return (
    <section className="provenance" aria-label="How this draft is assembled">
      <div className="prov-head">
        <span className="prov-title">{live ? "Assembling your draft" : "How this draft is assembled"}</span>
        <span className="prov-stats">
          {live ? (
            <>
              <b>{doneCount}</b>/{docType.skills.length} skills complete
            </>
          ) : (
            <>
              <b>{docType.skills.length}</b> expert skills
            </>
          )}
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
          drafting order, ending in the two-channel output. In live mode each
          node carries its real-time status. */}
      <div className="prov-rail" role="list">
        {docType.skills.map((s, i) => {
          const cls = live ? statusById[s.id] || "pending" : i === 0 ? "first" : "";
          return (
            <div key={s.id} className={`rail-node ${cls}`} role="listitem" title={s.label}>
              <span className="rail-dot" />
              <span className="rail-tip">{s.label}</span>
            </div>
          );
        })}
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
                  className={`refchip ${r.kind} ${refActive(r) ? "active" : ""}`}
                  title={`${KIND_LABEL[r.kind] || "Reference"} · used by ${r.ownerLabels.join(", ")}`}
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
