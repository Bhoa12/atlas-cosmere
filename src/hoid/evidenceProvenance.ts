/**
 * Provenance contract for spoiler-safe narrative evidence.
 *
 * This module deliberately stores no protected source text. A summary is only
 * eligible when it is an original description backed by an accessible source.
 */
export type EvidenceProvenance = Readonly<{
  evidenceId: string;
  sourceId: string;
  workId: string;
  chapter: number;
  accessible: boolean;
  summary: string;
  summaryOrigin: "original";
}>;

export type ProvenanceCheck =
  | Readonly<{ ok: true; value: EvidenceProvenance }>
  | Readonly<{ ok: false; reason: "invalid_evidence" | "inaccessible_source" | "non_original_summary" }>;

export function verifyEvidenceProvenance(
  candidate: EvidenceProvenance,
): ProvenanceCheck {
  if (
    !candidate.evidenceId.trim() ||
    !candidate.sourceId.trim() ||
    !candidate.workId.trim() ||
    !Number.isInteger(candidate.chapter) ||
    candidate.chapter < 1 ||
    !candidate.summary.trim()
  ) {
    return { ok: false, reason: "invalid_evidence" };
  }

  // Metadata or catalog membership never proves that a narrative passage was
  // accessible for this request.
  if (!candidate.accessible) {
    return { ok: false, reason: "inaccessible_source" };
  }

  if (candidate.summaryOrigin !== "original") {
    return { ok: false, reason: "non_original_summary" };
  }

  return {
    ok: true,
    value: Object.freeze({
      evidenceId: candidate.evidenceId,
      sourceId: candidate.sourceId,
      workId: candidate.workId,
      chapter: candidate.chapter,
      accessible: true,
      summary: candidate.summary,
      summaryOrigin: "original",
    }),
  };
}
