import { ReadingProgress, ReadingUnit } from "./readingProgress";

export interface ReadingProgressIntegrityResult {
  status: "valid" | "blocked";
  validUnits: readonly ReadingUnit[];
  validProgress: readonly ReadingProgress[];
  blockedUnitIds: readonly string[];
  blockedWorkIds: readonly string[];
}

/**
 * Validates structural reading metadata before it is used for progress or
 * spoiler gates. It never derives chapters, positions, or completion from
 * editorial knowledge: callers must provide verified unit metadata explicitly.
 *
 * The result is fail-closed. Any duplicate or cross-work completion blocks the
 * complete snapshot so unrelated reading state cannot unlock content.
 */
export function resolveReadingProgressIntegrity(
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
): ReadingProgressIntegrityResult {
  const seenUnitIds = new Set<string>();
  const positionsByWork = new Map<string, Set<number>>();
  const knownUnitWork = new Map<string, string>();
  const blockedUnitIds = new Set<string>();
  const blockedWorkIds = new Set<string>();

  for (const unit of units) {
    if (!unit.id || !unit.workId || !Number.isInteger(unit.position) || unit.position <= 0) {
      blockedUnitIds.add(unit.id);
      if (!unit.workId) blockedWorkIds.add(unit.workId);
    }
    if (seenUnitIds.has(unit.id)) blockedUnitIds.add(unit.id);
    seenUnitIds.add(unit.id);

    const positions = positionsByWork.get(unit.workId) ?? new Set<number>();
    if (positions.has(unit.position)) blockedWorkIds.add(unit.workId);
    positions.add(unit.position);
    positionsByWork.set(unit.workId, positions);
    knownUnitWork.set(unit.id, unit.workId);
  }

  const seenProgressWorks = new Set<string>();
  for (const entry of progress) {
    if (!entry.workId || seenProgressWorks.has(entry.workId)) {
      blockedWorkIds.add(entry.workId);
    }
    seenProgressWorks.add(entry.workId);

    const completed = new Set<string>();
    for (const unitId of entry.completedUnitIds) {
      const unitWorkId = knownUnitWork.get(unitId);
      if (!unitId || completed.has(unitId) || unitWorkId !== entry.workId) {
        blockedUnitIds.add(unitId);
        blockedWorkIds.add(entry.workId);
      }
      completed.add(unitId);
    }
  }

  if (blockedUnitIds.size || blockedWorkIds.size) {
    return {
      status: "blocked",
      validUnits: [],
      validProgress: [],
      blockedUnitIds: [...blockedUnitIds],
      blockedWorkIds: [...blockedWorkIds],
    };
  }

  return {
    status: "valid",
    validUnits: [...units],
    validProgress: progress.map((entry) => ({
      workId: entry.workId,
      completedUnitIds: [...entry.completedUnitIds],
    })),
    blockedUnitIds: [],
    blockedWorkIds: [],
  };
}
