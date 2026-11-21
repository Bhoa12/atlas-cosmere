import { HoidKnowledgeCatalog } from './catalog';
import { HoidAnswerRequest } from './types';
import {
  authorizeHoidCatalogAliasMentions,
  type HoidAliasDisclosurePort,
} from "./aliasDisclosureBoundary";

export type HoidContextDecision =
  | { allowed: true; allowedEntityIds: string[] }
  | { allowed: false; lockedEntityIds: string[] };

/**
 * Authorizes retrieval metadata before any provider is invoked. The caller must
 * never add locked entries to a prompt, vector query, or provider context.
 *
 * Entity first appearance and spelling/alias disclosure are independent:
 * every matched alias also needs an explicit host-owned authorization grant.
 */
export function authorizeHoidContext(
  request: HoidAnswerRequest,
  catalog: HoidKnowledgeCatalog,
  aliasDisclosurePort?: HoidAliasDisclosurePort | null,
): HoidContextDecision {
  const locked = catalog.lockedMatches(request.question, request.reading);
  if (locked.length > 0) {
    return { allowed: false, lockedEntityIds: locked.map(entry => entry.id) };
  }

  const aliasDecision = authorizeHoidCatalogAliasMentions(
    request.question,
    request.reading,
    catalog,
    aliasDisclosurePort,
  );
  if (aliasDecision.status !== "allowed") {
    return {
      allowed: false,
      lockedEntityIds: catalog.findMatches(request.question).map(entry => entry.id),
    };
  }

  return {
    allowed: true,
    allowedEntityIds: catalog
      .findMatches(request.question)
      .filter(entry => catalog.isEntityMentionUnlocked(entry, request.reading))
      .map(entry => entry.id)
  };
}
