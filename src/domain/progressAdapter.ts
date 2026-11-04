import type { ReaderProgress, WorkId } from './cosmereCatalog';

/**
 * Normalizes progress records at the catalog boundary.
 *
 * Existing world-specific stores can keep their own persistence format and
 * convert into this representation before spoiler filtering. When several
 * records exist for the same work, the furthest completed unit wins so an
 * import can never make a reader lose access to already-unlocked content.
 */
export function normalizeReaderProgress(
  records: readonly ReaderProgress[],
): ReaderProgress[] {
  const highestByWork = new Map<WorkId, number>();

  for (const record of records) {
    if (!Number.isInteger(record.completedUnitOrder) || record.completedUnitOrder < -1) {
      throw new Error(
        `Invalid completedUnitOrder for ${record.workId}: ${record.completedUnitOrder}`,
      );
    }

    const current = highestByWork.get(record.workId) ?? -1;
    highestByWork.set(record.workId, Math.max(current, record.completedUnitOrder));
  }

  return [...highestByWork.entries()]
    .map(([workId, completedUnitOrder]) => ({ workId, completedUnitOrder }))
    .sort((a, b) => a.workId.localeCompare(b.workId));
}
