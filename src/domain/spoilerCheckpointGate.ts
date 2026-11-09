import { ReadingProgress, ReadingUnit } from "./readingProgress";

export interface SpoilerCheckpointRequirement {
  contentId: string;
  workId: string;
  requiredUnitIds: readonly string[];
}

export interface SpoilerCheckpointDecision {
  contentId: string;
  allowed: boolean;
}

export interface SpoilerCheckpointGateResult {
  status: "valid" | "blocked";
  decisions: readonly SpoilerCheckpointDecision[];
}

/**
 * Resolves multi-unit spoiler checkpoints from explicit reading metadata only.
 * Every required unit must belong to the declared work and be completed in that
 * work's progress. Any malformed or ambiguous input blocks the entire batch.
 */
export function resolveSpoilerCheckpointGate(
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
  requirements: readonly SpoilerCheckpointRequirement[],
): SpoilerCheckpointGateResult {
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

  const decisions: SpoilerCheckpointDecision[] = [];
  for (const requirement of requirements) {
    if (!requirement.contentId || !requirement.workId || contentIds.has(requirement.contentId) || requirement.requiredUnitIds.length === 0) {
      return { status: "blocked", decisions: [] };
    }
    contentIds.add(requirement.contentId);
    const required = new Set<string>();
    for (const unitId of requirement.requiredUnitIds) {
      const unit = unitById.get(unitId);
      if (!unitId || required.has(unitId) || !unit || unit.workId !== requirement.workId) {
        return { status: "blocked", decisions: [] };
      }
      required.add(unitId);
    }
    const completed = progressByWork.get(requirement.workId);
    decisions.push({ contentId: requirement.contentId, allowed: [...required].every(id => completed?.has(id) ?? false) });
  }

  return { status: "valid", decisions };
}
