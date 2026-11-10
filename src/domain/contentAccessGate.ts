import { SpoilerVisibility } from "./spoilerVisibility";
import { ValidatedReadingProgressSnapshot } from "./validatedReadingProgress";

export interface ContentAccessDecision {
  contentId: string;
  access: "allowed" | "denied";
  reason: "visible" | "progress-blocked" | "visibility-blocked" | "unknown-content";
}

/**
 * Final metadata-only access boundary for editorial content.
 * It never supplies editorial text; callers must provide independently authored,
 * reviewed content only after this gate allows access.
 */
export function resolveContentAccessGate(
  progress: ValidatedReadingProgressSnapshot,
  visibility: readonly SpoilerVisibility[],
  requestedContentIds: readonly string[],
): readonly ContentAccessDecision[] {
  const requested = new Set<string>();
  if (progress.status !== "valid") {
    return requestedContentIds.map((contentId) => ({
      contentId,
      access: "denied",
      reason: "progress-blocked",
    }));
  }

  const byContent = new Map<string, SpoilerVisibility>();
  for (const item of visibility) {
    if (!item || !item.contentId.trim() || byContent.has(item.contentId)) {
      return requestedContentIds.map((contentId) => ({
        contentId,
        access: "denied",
        reason: "visibility-blocked",
      }));
    }
    byContent.set(item.contentId, item);
  }

  return requestedContentIds.map((contentId) => {
    if (!contentId.trim() || requested.has(contentId)) {
      return { contentId, access: "denied", reason: "unknown-content" };
    }
    requested.add(contentId);
    const state = byContent.get(contentId);
    if (!state) return { contentId, access: "denied", reason: "unknown-content" };
    return state.visibility === "visible"
      ? { contentId, access: "allowed", reason: "visible" }
      : { contentId, access: "denied", reason: "visibility-blocked" };
  });
}
