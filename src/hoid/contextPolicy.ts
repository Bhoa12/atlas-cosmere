import { HoidKnowledgeCatalog } from './catalog';
import { HoidAnswerRequest } from './types';

export type HoidContextDecision =
  | { allowed: true; allowedEntityIds: string[] }
  | { allowed: false; lockedEntityIds: string[] };

/**
 * Authorizes retrieval metadata before any provider is invoked. The caller must
 * never add locked entries to a prompt, vector query, or provider context.
 */
export function authorizeHoidContext(
  request: HoidAnswerRequest,
  catalog: HoidKnowledgeCatalog
): HoidContextDecision {
  const locked = catalog.lockedMatches(request.question, request.reading);
  if (locked.length > 0) {
    return { allowed: false, lockedEntityIds: locked.map(entry => entry.id) };
  }

  return {
    allowed: true,
    allowedEntityIds: catalog
      .findMatches(request.question)
      .filter(entry => catalog.isUnlocked(entry, request.reading))
      .map(entry => entry.id)
  };
}
