import { ReadingUnitProgressInput, hasConsistentReadingUnitProgress } from "./readingUnitProgress";

export interface ReadingProgressUnlockRequirement {
  unitId: string;
}

/**
 * Checks whether a spoiler-sensitive item may unlock at an already declared
 * reading unit. The function never infers units or accepts inconsistent
 * progress: the required unit must exist and belong to the completed,
 * contiguous reading prefix.
 */
export function canUnlockAtReadingUnit(
  requirement: ReadingProgressUnlockRequirement,
  progress: ReadingUnitProgressInput,
): boolean {
  if (typeof requirement.unitId !== "string" || !requirement.unitId.trim()) {
    return false;
  }

  if (!hasConsistentReadingUnitProgress(progress)) return false;

  const declared = progress.units.some(
    (unit) => unit.id === requirement.unitId,
  );

  return declared && progress.completedUnitIds.includes(requirement.unitId);
}
