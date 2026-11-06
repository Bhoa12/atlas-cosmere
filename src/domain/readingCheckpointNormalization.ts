import type { ReadingCheckpointState } from "./compositeSpoilerGates";

/**
 * Canonicalizes checkpoint states before they are evaluated by spoiler gates.
 * Only explicit, positive integer coordinates are retained. Entries for the
 * same work are merged, which prevents representation differences from
 * changing unlock behavior.
 */
export function normalizeCheckpointStates(
  states: readonly ReadingCheckpointState[],
): readonly ReadingCheckpointState[] {
  const positionsByWork = new Map<string, Set<number>>();

  for (const state of states) {
    const workId = state.workId.trim();
    if (!workId) continue;

    const positions = positionsByWork.get(workId) ?? new Set<number>();
    for (const position of state.completedPositions) {
      if (Number.isInteger(position) && position > 0) positions.add(position);
    }
    positionsByWork.set(workId, positions);
  }

  return [...positionsByWork.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([workId, positions]) => ({
      workId,
      completedPositions: [...positions].sort((a, b) => a - b),
    }));
}
