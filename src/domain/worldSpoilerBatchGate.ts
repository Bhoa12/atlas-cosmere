export type WorldSpoilerBatchRequest = {
  contentId: string;
  contentWorldId: string;
  requiredPosition: number;
};

export type WorldSpoilerBatchGateInput = {
  worldId: string;
  frontierStatus: "blocked" | "not-started" | "in-progress" | "complete";
  safeCompletedPositions: number;
  declaredPositions?: number;
  requests: WorldSpoilerBatchRequest[];
};

export type WorldSpoilerBatchGate =
  | { status: "blocked"; allowedContentIds: [] }
  | { status: "resolved"; allowedContentIds: string[] };

/**
 * Resolves a batch of content requests against one world's spoiler frontier.
 * This is a metadata-only boundary: malformed or ambiguous requests block the
 * entire batch rather than revealing a partial, potentially unsafe result.
 */
export function resolveWorldSpoilerBatchGate(
  input: WorldSpoilerBatchGateInput,
): WorldSpoilerBatchGate {
  const validWorldId =
    typeof input.worldId === "string" &&
    input.worldId.length > 0 &&
    input.worldId.trim() === input.worldId;

  const ids = input.requests.map((request) => request.contentId);
  const uniqueIds = new Set(ids);
  const validRequests =
    input.requests.length > 0 &&
    ids.every((id) => typeof id === "string" && id.length > 0 && id.trim() === id) &&
    uniqueIds.size === ids.length &&
    input.requests.every(
      (request) =>
        typeof request.contentWorldId === "string" &&
        request.contentWorldId === input.worldId &&
        request.contentWorldId.length > 0 &&
        request.contentWorldId.trim() === request.contentWorldId &&
        Number.isSafeInteger(request.requiredPosition) &&
        request.requiredPosition > 0,
    );

  const validCompleted =
    Number.isSafeInteger(input.safeCompletedPositions) &&
    input.safeCompletedPositions >= 0;

  const hasDeclaredPositions = input.declaredPositions !== undefined;
  const validDeclared =
    !hasDeclaredPositions ||
    (Number.isSafeInteger(input.declaredPositions) &&
      input.declaredPositions! > 0 &&
      validCompleted &&
      input.safeCompletedPositions <= input.declaredPositions! &&
      input.requests.every(
        (request) => request.requiredPosition <= input.declaredPositions!,
      ));

  const validFrontier =
    validCompleted &&
    (((input.frontierStatus === "blocked" ||
      input.frontierStatus === "not-started") &&
      input.safeCompletedPositions === 0) ||
      (input.frontierStatus === "in-progress" &&
        input.safeCompletedPositions > 0 &&
        (!hasDeclaredPositions ||
          input.safeCompletedPositions < input.declaredPositions!)) ||
      (input.frontierStatus === "complete" &&
        hasDeclaredPositions &&
        input.safeCompletedPositions === input.declaredPositions));

  if (!validWorldId || !validRequests || !validDeclared || !validFrontier) {
    return { status: "blocked", allowedContentIds: [] };
  }

  if (
    input.frontierStatus === "blocked" ||
    input.frontierStatus === "not-started"
  ) {
    return { status: "resolved", allowedContentIds: [] };
  }

  return {
    status: "resolved",
    allowedContentIds: input.requests
      .filter(
        (request) => request.requiredPosition <= input.safeCompletedPositions,
      )
      .map((request) => request.contentId),
  };
}
