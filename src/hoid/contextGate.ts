import { isCataloguedWork } from "./sourceCatalog";

export type ReadingProgress = ReadonlyMap<string, number>;
export type NarrativeEvidence = {
  id: string;
  workId: string;
  chapter: number;
  /** Must be an original summary, never protected source text. */
  summary: string;
  provenance: "accessible-original-summary";
};

export type Admission =
  | { ok: true; evidence: NarrativeEvidence }
  | { ok: false; reason: "unknown-work" | "no-progress" | "future-chapter" | "invalid-evidence" };

export function admitEvidence(
  progress: ReadingProgress,
  evidence: NarrativeEvidence,
): Admission {
  if (!isCataloguedWork(evidence.workId)) return { ok: false, reason: "unknown-work" };
  if (!Number.isInteger(evidence.chapter) || evidence.chapter < 0 || !evidence.summary.trim()) {
    return { ok: false, reason: "invalid-evidence" };
  }
  const reached = progress.get(evidence.workId);
  if (reached === undefined) return { ok: false, reason: "no-progress" };
  if (evidence.chapter > reached) return { ok: false, reason: "future-chapter" };
  return { ok: true, evidence };
}

/**
 * Fail-closed context builder. Unadmitted evidence is never returned.
 */
export function buildSafeContext(
  progress: ReadingProgress,
  candidates: readonly NarrativeEvidence[],
): readonly NarrativeEvidence[] {
  return candidates.flatMap((candidate) => {
    const result = admitEvidence(progress, candidate);
    return result.ok ? [result.evidence] : [];
  });
}
