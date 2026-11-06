export type WorldProgressStatus = "blocked" | "not-started" | "in-progress" | "complete";

export interface WorldProgressStatusInput {
  declaredPositions: number;
  completedPositions: number;
  next: unknown;
  ambiguousWorkIds: readonly string[];
}

/**
 * Converts structural progress coverage into a UI-safe status.
 *
 * Malformed counts fail closed instead of allowing a world to appear complete.
 */
export function resolveWorldProgressStatus(
  coverage: WorldProgressStatusInput,
): WorldProgressStatus {
  const countsValid =
    Number.isSafeInteger(coverage.declaredPositions) &&
    Number.isSafeInteger(coverage.completedPositions) &&
    coverage.declaredPositions > 0 &&
    coverage.completedPositions >= 0 &&
    coverage.completedPositions <= coverage.declaredPositions;

  if (!countsValid || coverage.ambiguousWorkIds.length > 0) {
    return "blocked";
  }

  if (coverage.completedPositions === 0) {
    return "not-started";
  }

  if (coverage.completedPositions === coverage.declaredPositions && coverage.next === null) {
    return "complete";
  }

  return "in-progress";
}
