/**
 * Provider-neutral authorized context boundary for Hoid IA.
 *
 * Context is derived from a request-scoped knowledge budget. This module
 * transports identifiers and original editorial summaries only; it never
 * requires protected source passages and cannot authorize new evidence.
 */

import {
  type CanonicalWorkId,
  type EvidenceId,
  type RequestKnowledgeBudget,
  isEvidenceAuthorized,
  narrowKnowledgeBudget,
} from "./requestKnowledgeBudget";

export interface AuthorizedContextItem {
  readonly evidenceId: EvidenceId;
  readonly workId: CanonicalWorkId;
  readonly maxChapter: number;
  readonly summary: string;
}

export interface AuthorizedContext {
  readonly items: readonly AuthorizedContextItem[];
  readonly evidenceIds: ReadonlySet<EvidenceId>;
}

const validSummary = (value: string): boolean =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 12000;

const validChapter = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

/**
 * Selects the minimal provider context from already-authorized editorial items.
 * Unknown, future, malformed, or unbudgeted items are excluded.
 */
export function createAuthorizedContext(
  budget: RequestKnowledgeBudget,
  candidates: readonly AuthorizedContextItem[],
  requestedEvidenceIds?: readonly EvidenceId[],
): AuthorizedContext {
  const effectiveBudget = requestedEvidenceIds
    ? narrowKnowledgeBudget(budget, requestedEvidenceIds)
    : budget;

  const items: AuthorizedContextItem[] = [];
  const seen = new Set<EvidenceId>();

  for (const candidate of candidates) {
    if (
      seen.has(candidate.evidenceId) ||
      !validSummary(candidate.summary) ||
      !validChapter(candidate.maxChapter) ||
      !isEvidenceAuthorized(effectiveBudget, candidate.evidenceId)
    ) {
      continue;
    }

    const readerChapter = effectiveBudget.positions.get(candidate.workId);
    if (readerChapter === undefined || candidate.maxChapter > readerChapter) {
      continue;
    }

    seen.add(candidate.evidenceId);
    items.push(Object.freeze({ ...candidate }));
  }

  return Object.freeze({
    items: Object.freeze(items),
    evidenceIds: new Set(items.map((item) => item.evidenceId)),
  });
}

/**
 * Re-checks a context against the original budget before a provider call.
 * This makes adapters unable to silently append evidence between selection
 * and execution.
 */
export function isContextWithinBudget(
  budget: RequestKnowledgeBudget,
  context: AuthorizedContext,
): boolean {
  return context.items.every((item) => {
    const readerChapter = budget.positions.get(item.workId);
    return (
      validSummary(item.summary) &&
      validChapter(item.maxChapter) &&
      readerChapter !== undefined &&
      item.maxChapter <= readerChapter &&
      isEvidenceAuthorized(budget, item.evidenceId) &&
      context.evidenceIds.has(item.evidenceId)
    );
  });
}
