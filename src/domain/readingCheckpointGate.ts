import { ReadingProgress, ReadingUnit } from "./readingProgress";

export interface ReadingCheckpointRequirement {
  contentId: string;
  workId: string;
  requiredUnitId: string;
}

export interface ReadingCheckpointDecision {
  contentId: string;
  allowed: boolean;
}

export interface ReadingCheckpointGateResult {
  status: "valid" | "blocked";
  decisions: readonly ReadingCheckpointDecision[];
}

/**
 * Resolves structural reading checkpoints without carrying narrative content.
 * A checkpoint can only unlock when its required unit exists, belongs to the
 * declared work, and that same work has explicitly completed the unit.
 * Invalid or ambiguous input blocks the whole batch (fail-closed).
 */
export function resolveReadingCheckpointGate(
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
  requirements: readonly ReadingCheckpointRequirement[],
): ReadingCheckpointGateResult {
  const unitById = new Map<string, ReadingUnit>();
  const progressByWork = new Map<string, Set<string>>();
  const contentIds = new Set<string>();

  for (const unit of units) {
    if (!unit.id || !unit.workId || !Number.isInteger(unit.position) || unit.position <= 0 || unitById.has(unit.id)) {
      return { status: "blocked", decisions: [] };
    }
    unitById.set(unit.id, unit);
  }

  for (const entry of progress) {
    if (!entry.workId || progressByWork.has(entry.workId)) return { status: "blocked", decisions: [] };
    const completed = new Set<string>();
    for (const unitId of entry.completedUnitIds) {
      const unit = unitById.get(unitId);
      if (!unitId || completed.has(unitId) || !unit || unit.workId !== entry.workId) {
        return { status: "blocked", decisions: [] };
      }
      completed.add(unitId);
    }
    progressByWork.set(entry.workId, completed);
  }

  const decisions: ReadingCheckpointDecision[] = [];
  for (const requirement of requirements) {
    if (!requirement.contentId || !requirement.workId || !requirement.requiredUnitId || contentIds.has(requirement.contentId)) {
      return { status: "blocked", decisions: [] };
    }
    contentIds.add(requirement.contentId);
    const unit = unitById.get(requirement.requiredUnitId);
    if (!unit || unit.workId !== requirement.workId) return { status: "blocked", decisions: [] };
    decisions.push({
      contentId: requirement.contentId,
      allowed: progressByWork.get(requirement.workId)?.has(requirement.requiredUnitId) ?? false,
    });
  }

  return { status: "valid", decisions };
}
