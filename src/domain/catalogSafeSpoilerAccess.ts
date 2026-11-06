import {
  filterUnlockedCompositeGateIds,
  type CompositeSpoilerGate,
  type ReadingCheckpointState,
} from "./compositeSpoilerGates";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { normalizeCheckpointStates } from "./readingCheckpointNormalization";
import { validateSpoilerGateCatalogCoverage } from "./spoilerGateCatalogCoverage";

/**
 * Resolves spoiler gates conservatively against both normalized progress and
 * declared catalog coordinates. A gate with any invalid catalog dependency is
 * never returned as unlocked.
 */
export function resolveCatalogSafeUnlockedGateIds(
  worlds: readonly WorldCatalogEntry[],
  gates: readonly CompositeSpoilerGate[],
  progress: readonly ReadingCheckpointState[],
): readonly string[] {
  const invalidGateIds = new Set(
    validateSpoilerGateCatalogCoverage(worlds, gates).map((issue) => issue.gateId),
  );
  const eligibleGates = gates.filter((gate) => !invalidGateIds.has(gate.id));

  return filterUnlockedCompositeGateIds(
    eligibleGates,
    normalizeCheckpointStates(progress),
  );
}
