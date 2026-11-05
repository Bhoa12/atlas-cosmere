import type { ReadingUnit, ReadingProgress } from "./readingProgress";

export interface ReadingStructureIssue {
  code: "duplicate_unit_id" | "invalid_position" | "duplicate_position";
  workId: string;
  unitId: string;
  conflictingUnitId?: string;
}

/**
 * Validates only declared reading metadata. It never invents missing units,
 * positions, or editorial structure.
 */
export function validateReadingStructure(
  units: readonly ReadingUnit[],
): readonly ReadingStructureIssue[] {
  const issues: ReadingStructureIssue[] = [];
  const byId = new Map<string, ReadingUnit>();
  const positionsByWork = new Map<string, Map<number, ReadingUnit>>();

  for (const unit of units) {
    const existingId = byId.get(unit.id);
    if (existingId) {
      issues.push({
        code: "duplicate_unit_id",
        workId: unit.workId,
        unitId: unit.id,
        conflictingUnitId: existingId.id,
      });
    } else {
      byId.set(unit.id, unit);
    }

    if (!Number.isInteger(unit.position) || unit.position < 1) {
      issues.push({ code: "invalid_position", workId: unit.workId, unitId: unit.id });
      continue;
    }

    const positions = positionsByWork.get(unit.workId) ?? new Map<number, ReadingUnit>();
    const existingPosition = positions.get(unit.position);
    if (existingPosition) {
      issues.push({
        code: "duplicate_position",
        workId: unit.workId,
        unitId: unit.id,
        conflictingUnitId: existingPosition.id,
      });
    } else {
      positions.set(unit.position, unit);
      positionsByWork.set(unit.workId, positions);
    }
  }

  return issues;
}
