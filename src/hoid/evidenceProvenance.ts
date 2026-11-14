export type EvidenceCandidate = Readonly<{
  evidenceId: string; sourceId: string; workId: string; chapter: number;
  accessible: boolean; summary: string; summaryOrigin: "original" | "protected_copy" | "unknown";
}>;
export type EvidenceProvenance = EvidenceCandidate & Readonly<{ summaryOrigin: "original"; accessible: true }>;
export type ProvenanceCheck = Readonly<{ok:true;value:EvidenceProvenance}> | Readonly<{ok:false;reason:"invalid_evidence"|"inaccessible_source"|"non_original_summary"}>;

export function verifyEvidenceProvenance(candidate: EvidenceCandidate): ProvenanceCheck {
  if (!candidate.evidenceId.trim() || !candidate.sourceId.trim() || !candidate.workId.trim() ||
      !Number.isInteger(candidate.chapter) || candidate.chapter < 1 || !candidate.summary.trim())
    return {ok:false,reason:"invalid_evidence"};
  if (!candidate.accessible) return {ok:false,reason:"inaccessible_source"};
  if (candidate.summaryOrigin !== "original") return {ok:false,reason:"non_original_summary"};
  return {ok:true,value:Object.freeze({...candidate, accessible:true as const, summaryOrigin:"original" as const})};
}
