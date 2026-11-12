/**
 * Technical boundary for provenance-aware Cosmere metadata.
 *
 * This module deliberately models only source availability and verification
 * state. It does not infer narrative facts, world membership, chronology,
 * chapter structure, or reading order.
 */

export type SourceAvailability =
  | "verified-index"
  | "declared-private"
  | "unavailable";

export interface SourceReference {
  sourceId: string;
  availability: SourceAvailability;
}

export interface ProvenanceDecision {
  accepted: boolean;
  reason: string;
}

const canonicalId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function evaluateSourceReference(
  reference: SourceReference,
): ProvenanceDecision {
  if (!canonicalId.test(reference.sourceId)) {
    return { accepted: false, reason: "invalid-source-id" };
  }

  if (reference.availability === "unavailable") {
    return { accepted: false, reason: "source-unavailable" };
  }

  return { accepted: true, reason: "source-reference-accepted" };
}

/**
 * Returns whether editorial enrichment may be authored from the supplied
 * provenance state. Declared private files are catalogued but are not treated
 * as inspected text.
 */
export function mayAuthorEditorialSummary(
  reference: SourceReference,
): boolean {
  return evaluateSourceReference(reference).accepted
    && reference.availability === "verified-index";
}
