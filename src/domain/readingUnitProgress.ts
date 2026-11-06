export interface ReadingUnit {
  id: string;
  order: number;
}

export interface ReadingUnitProgressInput {
  units: ReadingUnit[];
  completedUnitIds: string[];
}

/**
 * Validates unit-level progress without inferring missing editorial structure.
 * Progress is accepted only for a unique, contiguous prefix of declared units.
 */
export function hasConsistentReadingUnitProgress(
  input: ReadingUnitProgressInput,
): boolean {
  if (input.units.length === 0) return false;

  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();

  for (const unit of input.units) {
    if (
      typeof unit.id !== "string" ||
      !unit.id.trim() ||
      !Number.isSafeInteger(unit.order) ||
      unit.order <= 0 ||
      seenIds.has(unit.id) ||
      seenOrders.has(unit.order)
    ) {
      return false;
    }
    seenIds.add(unit.id);
    seenOrders.add(unit.order);
  }

  const completed = new Set(input.completedUnitIds);
  if (completed.size !== input.completedUnitIds.length) return false;
  if ([...completed].some((id) => typeof id !== "string" || !id.trim() || !seenIds.has(id))) return false;

  const ordered = [...input.units].sort((a, b) => a.order - b.order);
  return ordered.every(
    (unit, index) =>
      completed.has(unit.id) === (index < completed.size),
  );
}
