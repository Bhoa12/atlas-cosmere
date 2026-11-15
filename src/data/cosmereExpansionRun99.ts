/**
 * Safe reading roadmap helpers.
 *
 * A roadmap is presentation metadata only. It never invents chapter boundaries,
 * chronology, or narrative facts: callers must provide explicit reading units.
 */

export interface ReadingRoadmapUnit {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
  accessible: boolean;
}

export interface ReadingProgress {
  workId: string;
  completedUnitIds: readonly string[];
}

export interface RoadmapAudit {
  accepted: ReadingRoadmapUnit[];
  rejectedIds: string[];
}

export function auditReadingRoadmap(
  workId: string,
  units: readonly ReadingRoadmapUnit[],
): RoadmapAudit {
  const seenIds = new Set<string>();
  const seenPositions = new Set<number>();
  const accepted: ReadingRoadmapUnit[] = [];
  const rejectedIds: string[] = [];

  for (const unit of units) {
    const valid =
      unit.workId === workId &&
      unit.id.trim().length > 0 &&
      unit.sourceId.trim().length > 0 &&
      unit.accessible &&
      Number.isInteger(unit.position) &&
      unit.position >= 0 &&
      !seenIds.has(unit.id) &&
      !seenPositions.has(unit.position);

    if (!valid) {
      rejectedIds.push(unit.id);
      continue;
    }

    seenIds.add(unit.id);
    seenPositions.add(unit.position);
    accepted.push(unit);
  }

  accepted.sort((a, b) => a.position - b.position);
  return { accepted, rejectedIds };
}

export function roadmapProgress(
  workId: string,
  units: readonly ReadingRoadmapUnit[],
  progress: ReadingProgress,
): ReadingRoadmapUnit[] {
  if (progress.workId !== workId) return [];
  const { accepted } = auditReadingRoadmap(workId, units);
  const completed = new Set(progress.completedUnitIds);
  return accepted.filter(unit => completed.has(unit.id));
}
