import type { ReadingUnitManifestEntry } from "./readingUnitManifest";
import type { ValidatedReadingProgressSnapshot } from "./validatedReadingProgress";

export interface WorldReadingProgressSummary {
  worldId: string;
  totalUnits: number;
  completedUnits: number;
  pendingUnits: number;
  completionRatio: number;
}

export interface WorldReadingProgressSummaryResult {
  status: "valid" | "blocked";
  worlds: readonly WorldReadingProgressSummary[];
}

function isCanonicalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

/**
 * Summarizes explicit, already-validated reading progress by world.
 * This layer derives metrics only from manifest metadata and validated unit ids;
 * it never infers completion, reading order, or editorial facts.
 */
export function resolveWorldReadingProgressSummary(
  manifest: readonly ReadingUnitManifestEntry[],
  manifestValid: boolean,
  progress: ValidatedReadingProgressSnapshot,
): WorldReadingProgressSummaryResult {
  if (\n    !manifestValid ||\n    !progress ||\n    typeof progress !== "object" ||\n    progress.status !== "valid" ||\n    !Array.isArray(manifest) ||\n    !Array.isArray((progress as ValidatedReadingProgressSnapshot).completedUnitIds) ||\n    !Array.isArray((progress as ValidatedReadingProgressSnapshot).pendingUnitIds) ||\n    !(progress as ValidatedReadingProgressSnapshot).completedUnitIds.every(isCanonicalId) ||\n    !(progress as ValidatedReadingProgressSnapshot).pendingUnitIds.every(isCanonicalId)\n  ) {
    return { status: "blocked", worlds: [] };
  }

  const completed = new Set(progress.completedUnitIds);
  const pending = new Set(progress.pendingUnitIds);
  const known = new Set<string>();
  const counts = new Map<string, { total: number; completed: number; pending: number }>();

  for (const unit of manifest) {
    if (
      !unit ||
      typeof unit !== "object" ||
      !isCanonicalId((unit as ReadingUnitManifestEntry).worldId) ||
      !isCanonicalId((unit as ReadingUnitManifestEntry).unitId) ||
      known.has((unit as ReadingUnitManifestEntry).unitId)
    ) {
      return { status: "blocked", worlds: [] };
    }
    known.add(unit.unitId);
    const state = counts.get(unit.worldId) ?? { total: 0, completed: 0, pending: 0 };
    state.total += 1;
    if (completed.has(unit.unitId)) state.completed += 1;
    else if (pending.has(unit.unitId)) state.pending += 1;
    else return { status: "blocked", worlds: [] };
    counts.set(unit.worldId, state);
  }

  if (
    completed.size + pending.size !== known.size ||
    [...completed, ...pending].some((id) => !known.has(id)) ||
    [...completed].some((id) => pending.has(id))
  ) return { status: "blocked", worlds: [] };

  return {
    status: "valid",
    worlds: [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([worldId, state]) => ({
        worldId,
        totalUnits: state.total,
        completedUnits: state.completed,
        pendingUnits: state.pending,
        completionRatio: state.total === 0 ? 0 : state.completed / state.total,
      })),
  };
}
