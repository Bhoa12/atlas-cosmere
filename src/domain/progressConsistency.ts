export interface ProgressConsistencyInput {
  declaredPositions: number;
  completedPositions: number;
  next: unknown;
}

/**
 * Returns true only when structural progress coordinates are internally
 * consistent. Contradictions fail closed.
 */
export function hasConsistentProgress(
  progress: ProgressConsistencyInput,
): boolean {
  const validCounts =
    Number.isSafeInteger(progress.declaredPositions) &&
    Number.isSafeInteger(progress.completedPositions) &&
    progress.declaredPositions > 0 &&
    progress.completedPositions >= 0 &&
    progress.completedPositions <= progress.declaredPositions;

  if (!validCounts) return false;

  if (
    progress.completedPositions === progress.declaredPositions &&
    progress.next !== null
  ) {
    return false;
  }

  return true;
}
