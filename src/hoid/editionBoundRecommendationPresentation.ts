import {
  explainEditionBoundRecommendationResult,
  type HoidExplainedRecommendationResult,
} from "./editionBoundRecommendationExplanations";
import {
  recommendEditionBoundReadingNextSteps,
} from "./editionBoundRecommendations";

export type HoidRecommendationProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
}>;

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
 * explanation into a screen-ready view model bound to one progress identity.
 *
 * The caller must derive the identity from the same authoritative cursor-v2
 * snapshot passed here, then re-read progress before committing this result.
 * A revision mismatch is rejected. The fingerprint is retained so the UI can
 * hide the view model immediately when progress changes.
 *
 * This adapter does not open chapters, alter progress, inspect narrative
 * content, call a provider, or authorize evidence.
 */
export function createHoidEditionBoundRecommendationPresentation(
  progressInput: unknown,
  progressIdentity: HoidRecommendationProgressIdentity,
  limit = 3,
  activeBookId?: unknown,
): HoidEditionBoundRecommendationPresentation {
  if (
    !progressIdentity ||
    !Number.isSafeInteger(progressIdentity.revision) ||
    progressIdentity.revision < 0 ||
    typeof progressIdentity.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(progressIdentity.fingerprint)
  ) {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const recommendation = recommendEditionBoundReadingNextSteps(
    progressInput,
    limit,
    activeBookId,
  );
  const explained = explainEditionBoundRecommendationResult(recommendation);
  if (explained.status === "unavailable") return explained;

  if (explained.progressRevision !== progressIdentity.revision) {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  return Object.freeze({
    ...explained,
    progressFingerprint: progressIdentity.fingerprint,
  });
}
