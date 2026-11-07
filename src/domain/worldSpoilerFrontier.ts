export type WorldSpoilerFrontierInput = {
  declaredPositions: number;
  completedPositions: number;
  ambiguousWorkIds: string[];
};

export type WorldSpoilerFrontier =
  | { status: "blocked"; safeCompletedPositions: 0 }
  | { status: "not-started"; safeCompletedPositions: 0 }
  | { status: "in-progress"; safeCompletedPositions: number }
  | { status: "complete"; safeCompletedPositions: number };

/**
 * Produces a conservative, narrative-free spoiler frontier for a world's
 * declared reading sequence. It intentionally exposes only positions, never
 * titles, summaries or inferred editorial facts.
 */
export function resolveWorldSpoilerFrontier(
  input: WorldSpoilerFrontierInput,
): WorldSpoilerFrontier {
  const valid =
    Number.isInteger(input.declaredPositions) &&
    Number.isInteger(input.completedPositions) &&
    input.declaredPositions > 0 &&
    input.completedPositions >= 0 &&
    input.completedPositions <= input.declaredPositions &&
    input.ambiguousWorkIds.length === 0;

  if (!valid) return { status: "blocked", safeCompletedPositions: 0 };
  if (input.completedPositions === 0)
    return { status: "not-started", safeCompletedPositions: 0 };
  if (input.completedPositions === input.declaredPositions)
    return { status: "complete", safeCompletedPositions: input.completedPositions };

  return {
    status: "in-progress",
    safeCompletedPositions: input.completedPositions,
  };
}
