import type { WorkCatalogEntry } from "./cosmereCatalog";

export type WorkSequenceIssue =
  | { code: "invalid_sequence"; worldId: string; workId: string; sequence: number }
  | { code: "duplicate_sequence"; worldId: string; workId: string; conflictingWorkId: string; sequence: number };

/**
 * Validates ordering metadata inside each world without inferring publication
 * chronology or creating missing works. Sequence values are treated strictly
 * as declared catalog coordinates.
 */
export function validateWorkSequences(
  works: readonly WorkCatalogEntry[],
): readonly WorkSequenceIssue[] {
  const issues: WorkSequenceIssue[] = [];
  const byWorld = new Map<string, Map<number, WorkCatalogEntry>>();

  for (const work of works) {
    if (!Number.isInteger(work.sequence) || work.sequence < 1) {
      issues.push({
        code: "invalid_sequence",
        worldId: work.worldId,
        workId: work.id,
        sequence: work.sequence,
      });
      continue;
    }

    const sequences = byWorld.get(work.worldId) ?? new Map<number, WorkCatalogEntry>();
    const existing = sequences.get(work.sequence);
    if (existing) {
      issues.push({
        code: "duplicate_sequence",
        worldId: work.worldId,
        workId: work.id,
        conflictingWorkId: existing.id,
        sequence: work.sequence,
      });
    } else {
      sequences.set(work.sequence, work);
      byWorld.set(work.worldId, sequences);
    }
  }

  return issues;
}
