/**
 * End-to-end admission gate for narrative context.
 *
 * This is the only path that combines provenance and reader-progress checks.
 * Catalog presence alone is intentionally insufficient.
 */
import { verifyEvidenceProvenance, type EvidenceCandidate } from "./evidenceProvenance";
import { selectSafeContext, type HoidEvidence, type HoidProgress } from "./contextSelection";

export type ContextRejection = Readonly<{
  evidenceId: string;
  reason: "invalid_evidence" | "inaccessible_source" | "non_original_summary" | "outside_reader_progress";
}>;

export type AdmittedContext = Readonly<{
  allowed: readonly HoidEvidence[];
  rejected: readonly ContextRejection[];
}>;

/**
 * Fails closed in two phases: provenance first, then book/chapter progress.
 * Evidence that fails provenance never reaches context selection.
 */
export function admitNarrativeContext(
  progress: readonly HoidProgress[],
  candidates: readonly EvidenceCandidate[],
): AdmittedContext {
  const verified: HoidEvidence[] = [];
  const rejected: ContextRejection[] = [];

  for (const candidate of candidates) {
    const check = verifyEvidenceProvenance(candidate);
    if (!check.ok) {
      rejected.push({ evidenceId: candidate.evidenceId.trim(), reason: check.reason });
      continue;
    }
    verified.push(Object.freeze({
      evidenceId: check.value.evidenceId,
      sourceId: check.value.sourceId,
      bookId: check.value.workId,
      chapter: check.value.chapter,
      summary: check.value.summary,
    }));
  }

  const selected = selectSafeContext(progress, verified);
  for (const item of selected.rejected) {
    rejected.push({ evidenceId: item.evidenceId, reason: "outside_reader_progress" });
  }

  return Object.freeze({
    allowed: Object.freeze([...selected.allowed]),
    rejected: Object.freeze(rejected.map((item) => Object.freeze({ ...item }))),
  });
}
