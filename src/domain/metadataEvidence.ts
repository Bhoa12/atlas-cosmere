export type MetadataEvidenceStatus = "declared" | "verified";

export interface MetadataEvidence {
  /** Stable identifier for the metadata item; not editorial prose. */
  evidenceId: string;
  /** Catalog source that supports this item. */
  sourceId: string;
  /** A machine-readable locator supplied by an accessible source. */
  locator: string;
  status: MetadataEvidenceStatus;
}

export interface EvidenceBackedValue<T> {
  value: T;
  evidenceId: string;
}

/**
 * Returns only values backed by exactly one verified evidence record whose
 * source and locator are both non-empty. Missing, duplicate, declared-only,
 * or malformed evidence never unlocks metadata.
 */
export function resolveVerifiedMetadata<T>(
  values: readonly EvidenceBackedValue<T>[],
  evidence: readonly MetadataEvidence[],
): readonly T[] {
  const verifiedCounts = new Map<string, number>();

  for (const item of evidence) {
    if (
      item.status === "verified" &&
      item.sourceId.trim().length > 0 &&
      item.locator.trim().length > 0
    ) {
      verifiedCounts.set(item.evidenceId, (verifiedCounts.get(item.evidenceId) ?? 0) + 1);
    }
  }

  return values
    .filter((value) => verifiedCounts.get(value.evidenceId) === 1)
    .map((value) => value.value);
}
