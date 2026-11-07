export type NarrativeEvidenceKind = "summary" | "metadata";

/**
 * A compact provenance record for content derived from accessible evidence.
 * It intentionally stores no protected passage text.
 */
export interface NarrativeEvidenceRecord {
  evidenceId: string;
  sourceId: string;
  kind: NarrativeEvidenceKind;
  summaryId?: string;
}

/**
 * Validates evidence records without treating bibliographic declaration as
 * editorial access. Duplicate or malformed records are rejected.
 */
export function validateNarrativeEvidenceRegistry(
  records: readonly NarrativeEvidenceRecord[],
): string[] {
  const errors: string[] = [];
  const evidenceIds = new Set<string>();

  for (const record of records) {
    if (typeof record.evidenceId !== "string" || !record.evidenceId.trim()) {
      errors.push("Evidence id is required");
    } else if (evidenceIds.has(record.evidenceId)) {
      errors.push("Evidence ids must be unique");
    } else {
      evidenceIds.add(record.evidenceId);
    }

    if (typeof record.sourceId !== "string" || !record.sourceId.trim()) {
      errors.push("Evidence source id is required");
    }

    if (record.kind !== "summary" && record.kind !== "metadata") {
      errors.push("Evidence kind is invalid");
    }

    if (record.kind === "summary" && (
      typeof record.summaryId !== "string" || !record.summaryId.trim()
    )) {
      errors.push("Summary evidence requires a summary id");
    }
  }

  return errors;
}

/**
 * Returns true only for one explicitly registered summary evidence record.
 * Metadata evidence never authorizes narrative disclosure.
 */
export function hasRegisteredSummaryEvidence(
  evidenceId: string,
  sourceId: string,
  records: readonly NarrativeEvidenceRecord[],
): boolean {
  if (validateNarrativeEvidenceRegistry(records).length > 0) return false;
  return records.some((record) =>
    record.evidenceId === evidenceId &&
    record.sourceId === sourceId &&
    record.kind === "summary" &&
    typeof record.summaryId === "string" &&
    record.summaryId.trim().length > 0,
  );
}
