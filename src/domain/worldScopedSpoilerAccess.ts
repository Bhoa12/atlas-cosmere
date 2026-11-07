export type WorldScopedSpoilerAccessInput = {
  worldId: string;
  contentWorldId: string;
  requiredPosition: number;
  frontierStatus: "blocked" | "not-started" | "in-progress" | "complete";
  safeCompletedPositions: number;
  declaredPositions?: number;
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
 * The gate is fail-closed. Status/position inconsistencies, an invalid
 * position, or a content/world mismatch can never grant access.
 */
export function resolveWorldScopedSpoilerAccess(
  input: WorldScopedSpoilerAccessInput,
): WorldScopedSpoilerAccess {
  const normalizedWorldId = input.worldId.trim();
  const normalizedContentWorldId = input.contentWorldId.trim();
  const validWorldIds =
    normalizedWorldId.length > 0 &&
    normalizedContentWorldId.length > 0 &&
    normalizedWorldId === normalizedContentWorldId;
  const validPosition =
    Number.isInteger(input.requiredPosition) && input.requiredPosition > 0;
  const validFrontier =
    Number.isInteger(input.safeCompletedPositions) &&
    input.safeCompletedPositions >= 0;

  const hasDeclaredPositions = input.declaredPositions !== undefined;
  const validDeclaredPositions =
    !hasDeclaredPositions ||
    (Number.isInteger(input.declaredPositions) &&
      input.declaredPositions! > 0 &&
      input.safeCompletedPositions <= input.declaredPositions! &&
      input.requiredPosition <= input.declaredPositions!);

  const consistentStatus =
    (input.frontierStatus === "blocked" && input.safeCompletedPositions === 0) ||
    (input.frontierStatus === "not-started" &&
      input.safeCompletedPositions === 0) ||
    (input.frontierStatus === "in-progress" &&
      input.safeCompletedPositions > 0 &&
      (!hasDeclaredPositions ||
        input.safeCompletedPositions < input.declaredPositions!)) ||
    (input.frontierStatus === "complete" &&
      hasDeclaredPositions &&
      input.safeCompletedPositions === input.declaredPositions);

  if (
    !validWorldIds ||
    !validPosition ||
    !validFrontier ||
    !validDeclaredPositions ||
    !consistentStatus
  )
    return { status: "blocked", canReveal: false };

  if (
    input.frontierStatus === "blocked" ||
    input.frontierStatus === "not-started"
  )
    return { status: "locked", canReveal: false };

  if (input.requiredPosition > input.safeCompletedPositions)
    return { status: "locked", canReveal: false };

  return { status: "allowed", canReveal: true };
}
