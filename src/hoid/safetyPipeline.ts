/**
 * Hoid IA safety pipeline.
 * This module is intentionally provider-agnostic: narrative generation receives
 * only evidence that has already passed the caller's progress and spoiler gates.
 */
export type EvidenceId = string;

export interface AuthorizedRequest {
  question: string;
  workId: string;
  maxChapter: number;
  evidence: ReadonlyArray<{ id: EvidenceId; chapter: number; summary: string }>;
}

export interface ProviderDraft {
  text: string;
  evidenceIds: ReadonlyArray<EvidenceId>;
}

export interface NarrativeProvider {
  answer(request: {
    question: string;
    workId: string;
    maxChapter: number;
    evidence: ReadonlyArray<{ id: EvidenceId; chapter: number; summary: string }>;
  }): Promise<ProviderDraft>;
}

export type PipelineResult =
  | { kind: "answer"; text: string; evidenceIds: EvidenceId[] }
  | { kind: "abstain"; reason: "invalid-request" | "no-evidence" | "provider-failure" | "unverified-draft" };

function normalizeQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Executes the final generation boundary with fail-closed semantics.
 * No fallback knowledge is available to the provider through this contract.
 */
export async function runSafetyPipeline(
  request: AuthorizedRequest,
  provider: NarrativeProvider,
): Promise<PipelineResult> {
  const question = normalizeQuestion(request.question);
  if (!question || !request.workId || !Number.isInteger(request.maxChapter) || request.maxChapter < 1) {
    return { kind: "abstain", reason: "invalid-request" };
  }

  const evidence = request.evidence.filter(
    (item) => item.id.trim().length > 0 && item.chapter >= 1 && item.chapter <= request.maxChapter && item.summary.trim().length > 0,
  );
  if (evidence.length === 0) return { kind: "abstain", reason: "no-evidence" };

  let draft: ProviderDraft;
  try {
    draft = await provider.answer({ question, workId: request.workId, maxChapter: request.maxChapter, evidence });
  } catch {
    return { kind: "abstain", reason: "provider-failure" };
  }

  const allowed = new Set(evidence.map((item) => item.id));
  const evidenceIds = [...new Set(draft.evidenceIds)];
  if (!draft.text.trim() || evidenceIds.length === 0 || evidenceIds.some((id) => !allowed.has(id))) {
    return { kind: "abstain", reason: "unverified-draft" };
  }

  return { kind: "answer", text: draft.text.trim(), evidenceIds };
}
