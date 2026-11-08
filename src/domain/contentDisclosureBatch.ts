import { ContentEvidence } from "./contentEvidenceGate";
import {
  ContentDisclosureDecision,
  resolveContentDisclosureDecision,
} from "./contentDisclosureDecision";
import { SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding } from "./sourceWorkBinding";
import { ReadingProgressEntry } from "./readingProgressState";
import { ReadingUnit } from "./readingUnitRegistry";
import { SpoilerRevealRequest } from "./spoilerAuthorization";

export interface ContentDisclosureBatchResolution {
  status: "resolved" | "blocked";
  decisions: readonly ContentDisclosureDecision[];
}

/**
 * Resolves a declared batch only when every content identifier maps one-to-one
 * to one evidence record and one spoiler request. The batch carries no
 * narrative payload and fails closed rather than silently dropping mismatches.
 */
export function resolveContentDisclosureBatch(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgressEntry[],
  evidenceRecords: readonly ContentEvidence[],
  requests: readonly SpoilerRevealRequest[],
): ContentDisclosureBatchResolution {
  const evidenceIds = new Set<string>();
  for (const evidence of evidenceRecords) {
    if (!evidence.contentId || evidenceIds.has(evidence.contentId)) {
      return { status: "blocked", decisions: [] };
    }
    evidenceIds.add(evidence.contentId);
  }

  const requestsById = new Map<string, SpoilerRevealRequest>();
  for (const request of requests) {
    if (!request.contentId || requestsById.has(request.contentId)) {
      return { status: "blocked", decisions: [] };
    }
    requestsById.set(request.contentId, request);
  }

  if (evidenceRecords.length !== requests.length) {
    return { status: "blocked", decisions: [] };
  }

  const decisions: ContentDisclosureDecision[] = [];
  for (const evidence of evidenceRecords) {
    const request = requestsById.get(evidence.contentId);
    if (!request) return { status: "blocked", decisions: [] };
    decisions.push(resolveContentDisclosureDecision(
      catalog,
      bindings,
      declaredWorkIds,
      units,
      progress,
      evidence,
      request,
    ));
  }

  return { status: "resolved", decisions };
}
