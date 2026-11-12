/**
 * Technical reading-unit registry.
 *
 * This module intentionally stores structure, not protected prose or editorial
 * claims about chapters/pages. Units can be registered later from verified
 * source metadata without changing progress or spoiler consumers.
 */
export type ReadingUnit = {
  id: string;
  workId: string;
  kind: "work";
  position: number;
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateReadingUnits(units: readonly ReadingUnit[]) {
  const ids = new Set<string>();
  const workPositions = new Set<string>();
  for (const unit of units) {
    if (!ID.test(unit.id) || !ID.test(unit.workId)) {
      return { valid: false as const, reason: "non_canonical_id" };
    }
    if (unit.kind !== "work" || !Number.isInteger(unit.position) || unit.position < 1) {
      return { valid: false as const, reason: "invalid_unit_shape" };
    }
    if (ids.has(unit.id)) return { valid: false as const, reason: "duplicate_unit_id" };
    const positionKey = `${unit.workId}:${unit.position}`;
    if (workPositions.has(positionKey)) return { valid: false as const, reason: "duplicate_position" };
    ids.add(unit.id);
    workPositions.add(positionKey);
  }
  return { valid: true as const, reason: null };
}

export function buildWorkReadingUnits(workIds: readonly string[]): ReadingUnit[] {
  const seen = new Set<string>();
  const units: ReadingUnit[] = [];
  for (const workId of workIds) {
    if (!ID.test(workId) || seen.has(workId)) {
      throw new Error("Reading-unit work IDs must be canonical and unique");
    }
    seen.add(workId);
    units.push({ id: `unit-${workId}-work`, workId, kind: "work", position: 1 });
  }
  return units;
}
