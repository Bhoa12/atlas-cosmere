export type WorldScopedSpoilerAccessInput = {
  worldId: string;
  contentWorldId: string;
  requiredPosition: number;
  frontierStatus: "blocked" | "not-started" | "in-progress" | "complete";
  safeCompletedPositions: number;
};

export type WorldScopedSpoilerAccess =
  | { status: "blocked"; canReveal: false }
  | { status: "locked"; canReveal: false }
  | { status: "allowed"; canReveal: true };

/**
 * Applies a world's narrative-free spoiler frontier to one requested reading
 * position. The contract deliberately uses stable identifiers and positions
 * only: it does not carry titles, passages, summaries or editorial facts.
 *
 * The gate is fail-closed. A blocked frontier, an invalid position, or a
 * content/world mismatch can never grant access.
 */
export function resolveWorldScopedSpoilerAccess(
  input: WorldScopedSpoilerAccessInput,
): WorldScopedSpoilerAccess {
  const validWorldIds =
    input.worldId.trim().length > 0 &&
    input.contentWorldId.trim().length > 0 &&
    input.worldId === input.contentWorldId;
  const validPosition =
    Number.isInteger(input.requiredPosition) && input.requiredPosition > 0;
  const validFrontier =
    Number.isInteger(input.safeCompletedPositions) &&
    input.safeCompletedPositions >= 0;

  if (!validWorldIds || !validPosition || !validFrontier)
    return { status: "blocked", canReveal: false };

  if (input.frontierStatus === "blocked")
    return { status: "blocked", canReveal: false };

  if (input.requiredPosition > input.safeCompletedPositions)
    return { status: "locked", canReveal: false };

  return { status: "allowed", canReveal: true };
}
