import { DeclaredContentScopeEntry } from "./declaredContentScope";
import { ContentEvidence } from "./contentEvidenceGate";
import { SpoilerRevealRequest } from "./spoilerAuthorization";

export interface ContentScopeIntegrityResolution {
  status: "valid" | "blocked";
}

/**
 * Validates that technical content identifiers keep the same declared work
 * identity across structural scope, evidence and spoiler requests. This gate
 * carries no narrative payload and fails closed on ambiguity.
 */
export function resolveContentScopeIntegrity(
  scope: readonly DeclaredContentScopeEntry[],
  evidenceRecords: readonly ContentEvidence[],
  requests: readonly SpoilerRevealRequest[],
): ContentScopeIntegrityResolution {
  if (scope.length === 0) return { status: "blocked" };

  const scopeByContent = new Map<string, DeclaredContentScopeEntry>();
  for (const entry of scope) {
    if (!entry.contentId || !entry.workId || !entry.worldId || scopeByContent.has(entry.contentId)) {
      return { status: "blocked" };
    }
    scopeByContent.set(entry.contentId, entry);
  }

  const evidenceIds = new Set<string>();
  for (const evidence of evidenceRecords) {
    if (
      !evidence.contentId ||
      !evidence.workId ||
      evidenceIds.has(evidence.contentId) ||
      scopeByContent.get(evidence.contentId)?.workId !== evidence.workId
    ) return { status: "blocked" };
    evidenceIds.add(evidence.contentId);
  }

  const requestIds = new Set<string>();
  for (const request of requests) {
    if (!request.contentId || requestIds.has(request.contentId) || !scopeByContent.has(request.contentId)) {
      return { status: "blocked" };
    }
    requestIds.add(request.contentId);
  }

  return { status: "valid" };
}
