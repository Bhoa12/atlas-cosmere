import { ReadingProgressEntry, resolveReadingProgressState } from "./readingProgressState";
import { ReadingUnit } from "./readingUnitRegistry";

export interface SpoilerRevealRequest {
  contentId: string;
  requiredUnitIds: readonly string[];
}

export interface SpoilerAuthorization {
  status: "authorized" | "withheld" | "blocked";
}

/**
 * Authorizes a narrative reveal only from explicit, completed reading units.
 * This module stores no narrative text and never infers prerequisites from
 * titles, identifiers, world names, or editorial chronology.
 */
export function resolveSpoilerAuthorization(
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgressEntry[],
  request: SpoilerRevealRequest,
): SpoilerAuthorization {
  const contentId = typeof request.contentId === "string" ? request.contentId.trim() : "";
  if (!contentId || !Array.isArray(request.requiredUnitIds)) return { status: "blocked" };

  const state = resolveReadingProgressState(declaredWorkIds, units, progress);
  if (state.status !== "valid") return { status: "blocked" };

  const known = new Set(units.map((unit) => typeof unit.id === "string" ? unit.id.trim() : ""));
  const required = request.requiredUnitIds.map((id) => typeof id === "string" ? id.trim() : "");
  if (required.some((id) => !id || !known.has(id)) || new Set(required).size !== required.length) {
    return { status: "blocked" };
  }

  const completed = new Set(state.completedUnitIds);
  return required.every((id) => completed.has(id))
    ? { status: "authorized" }
    : { status: "withheld" };
}
