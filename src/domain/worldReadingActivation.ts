import { WorldExpansionExecutionGate } from "./worldExpansionExecutionGate";

export interface WorldReadingActivation {
  worldId: string;
  readingReady: boolean;
  reason: "activated" | "not-executable" | "missing-coverage" | "blocked";
}

/**
 * Combines an explicit structural execution decision with independently
 * supplied boolean coverage evidence. It never inspects source text or turns
 * missing evidence into permission to expose reading or editorial content.
 */
export function resolveWorldReadingActivation(
  execution: readonly WorldExpansionExecutionGate[],
  coverageByWorldId: Readonly<Record<string, boolean>>,
): readonly WorldReadingActivation[] {
  const invalid =
    new Set(execution.map(({ worldId }) => worldId)).size !== execution.length ||
    execution.some(({ worldId, executable, reason }) =>
      !worldId.trim() ||
      typeof executable !== "boolean" ||
      !["approved", "awaiting-catalog", "blocked", "missing-approval"].includes(reason),
    ) ||
    Object.entries(coverageByWorldId).some(([worldId, covered]) =>
      !worldId.trim() || typeof covered !== "boolean" ||
      !execution.some((entry) => entry.worldId === worldId),
    );

  if (invalid) {
    return execution.map(({ worldId }) => ({ worldId, readingReady: false, reason: "blocked" as const }));
  }

  return execution.map(({ worldId, executable }) => {
    if (!executable) {
      return { worldId, readingReady: false, reason: "not-executable" as const };
    }

    if (coverageByWorldId[worldId] !== true) {
      return { worldId, readingReady: false, reason: "missing-coverage" as const };
    }

    return { worldId, readingReady: true, reason: "activated" as const };
  });
}
