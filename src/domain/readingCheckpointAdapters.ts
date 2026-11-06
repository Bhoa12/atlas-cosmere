import type { ReadingCheckpointState } from "./compositeSpoilerGates";
import type { ReaderProgress } from "./cosmereCatalog";
import type { ReadingUnit, ReadingProgress } from "./readingProgress";

/**
 * Adapts declared unit completion into exact checkpoint positions.
 * Unknown unit ids and units belonging to another work are ignored rather than
 * guessed, so incomplete metadata cannot unlock spoiler-gated content.
 */
export function toCheckpointStates(
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
): readonly ReadingCheckpointState[] {
  return progress.map((entry) => {
    const positions = new Set(
      units
        .filter((unit) => unit.workId === entry.workId && entry.completedUnitIds.includes(unit.id))
        .map((unit) => unit.position),
    );
    return { workId: entry.workId, completedPositions: [...positions].sort((a, b) => a - b) };
  });
}

/**
 * Adapts catalog progress to the same exact checkpoint model. The reported
 * coordinate is preserved only when it is a positive integer.
 */
export function catalogProgressToCheckpointStates(
  progress: readonly ReaderProgress[],
): readonly ReadingCheckpointState[] {
  return progress
    .filter((entry) => Number.isInteger(entry.completedUnitOrder) && entry.completedUnitOrder >= 1)
    .map((entry) => ({
      workId: entry.workId,
      completedPositions: [entry.completedUnitOrder],
    }));
}
