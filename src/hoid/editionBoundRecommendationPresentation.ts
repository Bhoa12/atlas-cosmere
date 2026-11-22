import { fingerprintHoidCursorProgressSnapshot } from "./knowledgeGraph";
import {
  explainEditionBoundRecommendationResult,
  type HoidExplainedRecommendationResult,
} from "./editionBoundRecommendationExplanations";
import {
  recommendEditionBoundReadingNextSteps,
} from "./editionBoundRecommendations";

type ReadyExplanation = Extract<HoidExplainedRecommendationResult, { status: "ready" }>;
type SelectionExplanation = Extract<HoidExplainedRecommendationResult, { status: "selection-required" }>;

export type HoidEditionBoundRecommendationPresentation =
  | (ReadyExplanation & Readonly<{ progressFingerprint: string }>)
  | (SelectionExplanation & Readonly<{ progressFingerprint: string }>)
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "invalid-limit" | "invalid-active-work";
    }>;

/**
 * Compose the deterministic recommendation core and its metadata-only
 * explanation into a screen-ready view model bound to the exact validated
 * cursor-v2 snapshot.
 *
 * The adapter derives the canonical revision and SHA-256 fingerprint itself;
 * callers cannot accidentally pair a valid recommendation with an identity
 * copied from a different snapshot. The screen must still re-read authoritative
 * progress before committing the view model and hide it when that identity
 * changes.
 *
 * This adapter does not open chapters, alter progress, inspect narrative
 * content, call a provider, or authorize evidence.
 */
export function createHoidEditionBoundRecommendationPresentation(
  progressInput: unknown,
  limit = 3,
  activeBookId?: unknown,
): HoidEditionBoundRecommendationPresentation {
  const identity = fingerprintHoidCursorProgressSnapshot(progressInput);
  if (identity.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const recommendation = recommendEditionBoundReadingNextSteps(
    progressInput,
    limit,
    activeBookId,
  );
  const explained = explainEditionBoundRecommendationResult(recommendation);
  if (explained.status === "unavailable") return explained;

  if (explained.progressRevision !== identity.revision) {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  return Object.freeze({
    ...explained,
    progressFingerprint: identity.sha256,
  });
}
