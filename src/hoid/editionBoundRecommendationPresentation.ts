import { validateHoidCursorProgressSnapshot } from "./cursorProgressLedger";
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
type NoSafeNextWorkExplanation = Extract<HoidExplainedRecommendationResult, { status: "no-safe-next-work" }>;

export type HoidEditionBoundRecommendationPresentation =
  | (ReadyExplanation & Readonly<{ progressFingerprint: string }>)
  | (SelectionExplanation & Readonly<{ progressFingerprint: string }>)
  | (NoSafeNextWorkExplanation & Readonly<{ progressFingerprint: string }>)
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "invalid-limit" | "invalid-active-work" | "invalid-recommendation";
    }>;

/**
 * Compose the deterministic recommendation core and its metadata-only
 * explanation into a screen-ready view model bound to one canonicalized
 * cursor-v2 snapshot.
 *
 * The untrusted input is validated and copied exactly once. Fingerprinting and
 * recommendation generation then consume that same immutable canonical
 * snapshot, preventing accessor/proxy time-of-check-to-time-of-use drift.
 * The screen must still re-read authoritative progress before committing the
 * view model and hide it when that identity changes.
 *
 * This adapter does not open chapters, alter progress, inspect narrative
 * content, call a provider, or authorize evidence.
 */
export function createHoidEditionBoundRecommendationPresentation(
  progressInput: unknown,
  limit = 3,
  activeBookId?: unknown,
): HoidEditionBoundRecommendationPresentation {
  const validation = validateHoidCursorProgressSnapshot(progressInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const canonicalProgress = validation.snapshot;
  const identity = fingerprintHoidCursorProgressSnapshot(canonicalProgress);
  if (identity.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const recommendation = recommendEditionBoundReadingNextSteps(
    canonicalProgress,
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
