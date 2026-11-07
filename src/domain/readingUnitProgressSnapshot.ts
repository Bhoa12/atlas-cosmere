import { ReadingUnitProgressInput, hasConsistentReadingUnitProgress } from "./readingUnitProgress";

export type ReadingUnitProgressStatus =
  | "blocked"
  | "not-started"
  | "in-progress"
  | "complete";

/**
 * Resolves a presentation-safe progress snapshot from already declared units.
 * Invalid or ambiguous structure never produces an optimistic status.
 */
export function resolveReadingUnitProgressStatus(
  input: ReadingUnitProgressInput,
): ReadingUnitProgressStatus {
  if (!hasConsistentReadingUnitProgress(input)) return "blocked";

  const completedCount = input.completedUnitIds.length;
  if (completedCount === 0) return "not-started";
  if (completedCount === input.units.length) return "complete";
  return "in-progress";
}
