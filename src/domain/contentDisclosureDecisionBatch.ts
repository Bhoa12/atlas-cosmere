import { ContentDisclosureDecision, resolveContentDisclosureDecision } from "./contentDisclosureDecision";
import { ContentEvidence } from "./contentEvidenceGate";
import { SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding } from "./sourceWorkBinding";
import { ReadingProgressEntry } from "./readingProgressState";
import { ReadingUnit } from "./readingUnitRegistry";
import { SpoilerRevealRequest } from "./spoilerAuthorization";

export interface ContentDisclosureDecisionBatch {
  status: "ready" | "blocked";
  decisions: readonly ContentDisclosureDecision[];
  blockedContentIds: readonly string[];
}

/**
 * Resolves a declared batch only after proving a strict one-to-one mapping
 * between evidence and spoiler requests. It returns no partial decisions when
 * the batch itself is ambiguous or malformed.
 */
export function resolveContentDisclosureDecisionBatch(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgressEntry[],
  evidenceItems: readonly ContentEvidence[],
  requests: readonly SpoilerRevealRequest[],
): ContentDisclosureDecisionBatch {
  const evidenceIds = evidenceItems.map((item) => item.contentId);
  const requestIds = requests.map((item) => item.contentId);
  const duplicates = (ids: readonly string[]) => ids.filter((id, index) => ids.indexOf(id) !== index);
  const blockedContentIds = [...new Set([
    ...duplicates(evidenceIds),
    ...duplicates(requestIds),
    ...evidenceIds.filter((id) => !requestIds.includes(id)),
    ...requestIds.filter((id) => !evidenceIds.includes(id)),
  ])];

  if (blockedContentIds.length > 0) {
    return { status: "blocked", decisions: [], blockedContentIds };
  }

  const requestById = new Map(requests.map((request) => [request.contentId, request]));
  return {
    status: "ready",
    decisions: evidenceItems.map((evidence) => resolveContentDisclosureDecision(
      catalog,
      bindings,
      declaredWorkIds,
      units,
      progress,
      evidence,
      requestById.get(evidence.contentId)!,
    )),
    blockedContentIds: [],
  };
}
