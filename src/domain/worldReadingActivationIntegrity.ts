import { WorldReadingActivation } from "./worldReadingActivation";

export interface WorldReadingActivationIntegrity {
  valid: boolean;
  duplicateWorldIds: readonly string[];
  invalidEntries: readonly string[];
}

/**
 * Validates activation records before any downstream reading-unit or progress
 * layer consumes them. This is metadata-only and deliberately fail-closed.
 */
export function resolveWorldReadingActivationIntegrity(
  activations: readonly WorldReadingActivation[],
): WorldReadingActivationIntegrity {
  const counts = new Map<string, number>();
  const invalidEntries: string[] = [];

  for (const entry of activations) {
    counts.set(entry.worldId, (counts.get(entry.worldId) ?? 0) + 1);

    const reasonValid = ["activated", "not-executable", "missing-coverage", "blocked"].includes(entry.reason);
    const stateConsistent =
      (entry.reason === "activated") === entry.readingReady;

    if (!entry.worldId.trim() || !reasonValid || !stateConsistent) {
      invalidEntries.push(entry.worldId);
    }
  }

  const duplicateWorldIds = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([worldId]) => worldId);

  return {
    valid: duplicateWorldIds.length === 0 && invalidEntries.length === 0,
    duplicateWorldIds,
    invalidEntries,
  };
}
