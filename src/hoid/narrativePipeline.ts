import {
  buildSafeContext,
  type Evidence,
  type SafeRequest,
} from "./safetyBoundary";

export type PipelineResult =
  | {
      ok: true;
      question: string;
      intent: SafeRequest["intent"];
      sourceId: SafeRequest["progress"]["sourceId"];
      maxChapter: number;
      evidence: readonly Evidence[];
    }
  | {
      ok: false;
      reason: "invalid-request" | "no-authorized-evidence";
    };

/**
 * Provider-independent entry point for Hoid IA's narrative pipeline.
 *
 * This function deliberately stops before generation. A provider can only be
 * invoked by an adapter after this result is ok, so authorization remains
 * outside the model/provider boundary.
 */
export function prepareNarrativePipeline(
  request: SafeRequest,
  candidates: readonly Evidence[],
): PipelineResult {
  const safe = buildSafeContext(request, candidates);

  if (!safe.ok) {
    return { ok: false, reason: safe.reason };
  }

  return {
    ok: true,
    question: safe.context.request.question.trim(),
    intent: safe.context.request.intent,
    sourceId: safe.context.request.progress.sourceId,
    maxChapter: safe.context.request.progress.chapter,
    evidence: safe.context.evidence,
  };
}
