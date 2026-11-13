import { validReadingPositions } from "./readingValidation";
import { ReadingPosition } from "./types";

/**
 * Immutable authorization ceiling for one Hoid request.
 *
 * Progress is validated once and detached from caller-owned state. Downstream
 * code must receive this snapshot instead of re-reading mutable UI state.
 */
export type HoidProgressSnapshot = Readonly<{
  reading: readonly Readonly<ReadingPosition>[];
}>;

export function createProgressSnapshot(progress: unknown): HoidProgressSnapshot | null {
  const validated = validReadingPositions(progress);
  if (validated === null) return null;

  const reading = validated.map(position => Object.freeze({ ...position }));
  return Object.freeze({ reading: Object.freeze(reading) });
}

/**
 * Returns a detached request reading array derived from the original snapshot.
 * This makes accidental mutation by a downstream integration harmless.
 */
export function readingFromSnapshot(
  snapshot: HoidProgressSnapshot,
): readonly Readonly<ReadingPosition>[] {
  return Object.freeze(snapshot.reading.map(position => Object.freeze({ ...position })));
}
