import type { MetadataEvidence } from "./metadataEvidence";

export interface EvidenceUnlockRequirement {
  evidenceId: string;
}

function isUniquelyVerified(
  evidenceId: string,
  evidence: readonly MetadataEvidence[],
): boolean {
  const matches = evidence.filter(
    (item) =>
      item.evidenceId === evidenceId &&
      item.status === "verified" &&
      item.sourceId.trim().length > 0 &&
      item.locator.trim().length > 0,
  );

  return matches.length === 1;
}

/**
 * Returns true only when every requirement is non-empty, unique, and backed by
 * exactly one structurally valid verified evidence record. This deliberately
 * fails closed so missing or ambiguous evidence cannot unlock spoiler-sensitive
 * content.
 */
export function canUnlockWithEvidence(
  requirements: readonly EvidenceUnlockRequirement[],
  evidence: readonly MetadataEvidence[],
): boolean {
  if (requirements.length === 0) return false;

  const ids = requirements.map((requirement) => requirement.evidenceId.trim());
  if (ids.some((id) => id.length === 0)) return false;
  if (new Set(ids).size !== ids.length) return false;

  return ids.every((id) => isUniquelyVerified(id, evidence));
}
