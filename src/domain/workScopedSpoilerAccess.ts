export type WorkScopedSpoilerAccessInput = {
  worldId: string;
  contentWorldId: string;
  workId: string;
  contentWorkId: string;
  requiredPosition: number;
  safeCompletedPositions: number;
  declaredPositions: number;
};

/**
 * Narrows spoiler access to a single work as well as a world. Positions are
 * meaningful only inside the reading sequence they belong to, so matching a
 * world alone can never authorize a position from another work.
 *
 * This contract carries identifiers and numeric positions only. It does not
 * contain titles, passages, summaries or editorial facts.
 */
export function canRevealWorkScopedPosition(
  input: WorkScopedSpoilerAccessInput,
): boolean {
  const ids = [
    input.worldId,
    input.contentWorldId,
    input.workId,
    input.contentWorkId,
  ].map((value) => value.trim());

  if (
    ids.some((value) => value.length === 0) ||
    ids[0] !== ids[1] ||
    ids[2] !== ids[3]
  ) {
    return false;
  }

  if (
    !Number.isInteger(input.requiredPosition) ||
    !Number.isInteger(input.safeCompletedPositions) ||
    !Number.isInteger(input.declaredPositions) ||
    input.requiredPosition <= 0 ||
    input.safeCompletedPositions < 0 ||
    input.declaredPositions <= 0 ||
    input.safeCompletedPositions > input.declaredPositions ||
    input.requiredPosition > input.declaredPositions
  ) {
    return false;
  }

  return input.requiredPosition <= input.safeCompletedPositions;
}
