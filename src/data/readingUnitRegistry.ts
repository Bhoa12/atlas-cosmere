/**
 * Runtime-safe registry for reader-defined units.
 *
 * Units are technical reading checkpoints. They deliberately do not encode
 * chapters, page ranges, chronology or narrative facts. Editorial structure
 * may be attached later only from verified metadata.
 */
export type ReadingUnit = {
  id: string;
  workId: string;
  label: string;
  position: number;
};

export type ReadingUnitRegistryResult =
  | { status: 'valid'; units: readonly ReadingUnit[] }
  | { status: 'blocked'; reason: 'invalid_registry' };

function isCanonicalText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function validateReadingUnitRegistry(input: unknown): ReadingUnitRegistryResult {
  if (!Array.isArray(input)) {
    return { status: 'blocked', reason: 'invalid_registry' };
  }

  const unitIds = new Set<string>();
  const workPositions = new Set<string>();

  for (const value of input) {
    if (!value || typeof value !== 'object') {
      return { status: 'blocked', reason: 'invalid_registry' };
    }

    const unit = value as Partial<ReadingUnit>;
    if (
      !isCanonicalText(unit.id) ||
      !isCanonicalText(unit.workId) ||
      !isCanonicalText(unit.label) ||
      !isSafePositiveInteger(unit.position)
    ) {
      return { status: 'blocked', reason: 'invalid_registry' };
    }

    const workPosition = `${unit.workId}:${unit.position}`;
    if (unitIds.has(unit.id) || workPositions.has(workPosition)) {
      return { status: 'blocked', reason: 'invalid_registry' };
    }

    unitIds.add(unit.id);
    workPositions.add(workPosition);
  }

  return { status: 'valid', units: input as readonly ReadingUnit[] };
}

export function listReadingUnitsForWork(
  registry: unknown,
  workId: unknown,
): readonly ReadingUnit[] {
  const validation = validateReadingUnitRegistry(registry);
  if (validation.status !== 'valid' || !isCanonicalText(workId)) {
    return [];
  }

  return validation.units
    .filter((unit) => unit.workId === workId)
    .slice()
    .sort((left, right) => left.position - right.position);
}
