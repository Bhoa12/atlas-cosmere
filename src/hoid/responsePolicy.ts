export type ResponseMode = "explain" | "recommend";
export type EvidenceRef = { id: string; workId: string; chapter: number };
export type ReadingProgress = Record<string, number>;

export type ResponsePolicyInput = {
  mode: ResponseMode;
  progress: ReadingProgress;
  evidence: EvidenceRef[];
};

/**
 * Final fail-closed policy boundary shared by explanations and recommendations.
 * Evidence is visible only when its work and chapter are within the reader's
 * immutable progress snapshot. Unknown works and malformed chapters are denied.
 */
export function authorizeResponseEvidence(input: ResponsePolicyInput): EvidenceRef[] {
  const seen = new Set<string>();
  return input.evidence.filter((item) => {
    if (!item.id || !item.workId || !Number.isInteger(item.chapter) || item.chapter < 1) return false;
    const reached = input.progress[item.workId];
    if (!Number.isInteger(reached) || reached < item.chapter) return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function responseStatus(input: ResponsePolicyInput): "authorized" | "abstain" {
  return authorizeResponseEvidence(input).length > 0 ? "authorized" : "abstain";
}
