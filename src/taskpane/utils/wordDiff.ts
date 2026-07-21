/**
 * Word/segment-level diff of an inserted draft (before) against its
 * post-edit text (after). Used to describe, deterministically, WHAT the
 * lawyer changed before Claude is asked to predict WHY.
 *
 * Deliberately dependency-free: a classic token-level LCS is a few dozen
 * lines and more than fast enough for a single document section (hundreds
 * of words). Adjacent delete+add runs are coalesced into one "modified"
 * change so a reworded clause reads as one edit, not a delete next to an
 * unrelated add.
 */

export interface DiffChange {
  kind: "added" | "deleted" | "modified";
  /** Present for "deleted" and "modified": the original text. */
  before?: string;
  /** Present for "added" and "modified": the replacement/new text. */
  after?: string;
}

export interface SegmentDiff {
  /** Ordered, non-equal runs only. */
  changes: DiffChange[];
  summary: { added: number; deleted: number; modified: number };
  /** Changed tokens / max(beforeTokens, afterTokens); 0 when identical. */
  changedFraction: number;
  /** True when before and after are equal after normalization. */
  unchanged: boolean;
}

/** Above this token count on either side, fall back to a coarse line diff. */
const MAX_TOKENS = 4000;

function normalize(text: string): string {
  return text.replace(/\r\n|\r/g, "\n");
}

/** Whitespace-delimited tokens, plus standalone newlines so structure survives. */
function tokenize(text: string): string[] {
  const matches = normalize(text).match(/\n|[^\s]+/g);
  return matches ?? [];
}

type Op = { op: "equal" | "delete" | "insert"; token: string };

/**
 * Longest-common-subsequence diff over two token arrays, returned as an
 * ordered op stream. O(n*m) time/space -- bounded by MAX_TOKENS callers.
 */
function lcsDiff(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ op: "equal", token: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: "delete", token: a[i] });
      i++;
    } else {
      ops.push({ op: "insert", token: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ op: "delete", token: a[i++] });
  while (j < m) ops.push({ op: "insert", token: b[j++] });
  return ops;
}

/** Collapse an op stream into ordered added/deleted/modified changes. */
function opsToChanges(ops: Op[]): DiffChange[] {
  const changes: DiffChange[] = [];
  let delBuf: string[] = [];
  let addBuf: string[] = [];

  const flush = () => {
    if (delBuf.length && addBuf.length) {
      changes.push({ kind: "modified", before: delBuf.join(" "), after: addBuf.join(" ") });
    } else if (delBuf.length) {
      changes.push({ kind: "deleted", before: delBuf.join(" ") });
    } else if (addBuf.length) {
      changes.push({ kind: "added", after: addBuf.join(" ") });
    }
    delBuf = [];
    addBuf = [];
  };

  for (const { op, token } of ops) {
    if (op === "equal") {
      flush();
    } else if (op === "delete") {
      delBuf.push(token);
    } else {
      addBuf.push(token);
    }
  }
  flush();
  return changes;
}

function summarize(changes: DiffChange[]): SegmentDiff["summary"] {
  return {
    added: changes.filter((c) => c.kind === "added").length,
    deleted: changes.filter((c) => c.kind === "deleted").length,
    modified: changes.filter((c) => c.kind === "modified").length,
  };
}

export function diffSegments(before: string, after: string): SegmentDiff {
  const beforeNorm = normalize(before).trim();
  const afterNorm = normalize(after).trim();

  if (beforeNorm === afterNorm) {
    return { changes: [], summary: { added: 0, deleted: 0, modified: 0 }, changedFraction: 0, unchanged: true };
  }

  // Guard against pathological cost: on very large inputs, diff by line
  // instead of by word. Lines are far fewer, keeping O(n*m) tractable.
  const beforeTokens = tokenize(beforeNorm);
  const afterTokens = tokenize(afterNorm);
  const useLines = beforeTokens.length > MAX_TOKENS || afterTokens.length > MAX_TOKENS;
  const a = useLines ? beforeNorm.split("\n") : beforeTokens;
  const b = useLines ? afterNorm.split("\n") : afterTokens;

  const ops = lcsDiff(a, b);
  const changedTokens = ops.filter((o) => o.op !== "equal").length;

  // Text that differs only in whitespace/line breaks tokenizes identically,
  // so there are no real changes -- treat it as unchanged so the caller
  // doesn't fire a prediction on a purely cosmetic edit.
  if (changedTokens === 0) {
    return { changes: [], summary: { added: 0, deleted: 0, modified: 0 }, changedFraction: 0, unchanged: true };
  }

  const changes = opsToChanges(ops);
  const changedFraction = changedTokens / Math.max(a.length, b.length, 1);

  return { changes, summary: summarize(changes), changedFraction, unchanged: false };
}
