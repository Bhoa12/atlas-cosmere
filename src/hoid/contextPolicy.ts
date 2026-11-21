import { HoidKnowledgeCatalog } from "./catalog";
import type { HoidAnswerRequest } from "./types";
import {
  authorizeHoidCatalogAliasMentions,
  type HoidAliasDisclosurePort,
  type HoidAliasDisclosureProgressWitness,
} from "./aliasDisclosureBoundary";

export type HoidContextDecision =
  | { allowed: true; allowedEntityIds: string[]; progressWitness: HoidAliasDisclosureProgressWitness | null }
  | { allowed: false; lockedEntityIds: string[] };

export async function authorizeHoidContext(
  request: HoidAnswerRequest,
  catalog: HoidKnowledgeCatalog,
  aliasDisclosurePort?: HoidAliasDisclosurePort | null,
): Promise<HoidContextDecision> {
  const locked = catalog.lockedMatches(request.question, request.reading);
  if (locked.length > 0) return { allowed: false, lockedEntityIds: locked.map(entry => entry.id) };

  const aliasDecision = await authorizeHoidCatalogAliasMentions(
    request.question,
    request.reading,
    catalog,
    aliasDisclosurePort,
  );
  if (aliasDecision.status !== "allowed") {
    return { allowed: false, lockedEntityIds: catalog.findMatches(request.question).map(entry => entry.id) };
  }

  return {
    allowed: true,
    progressWitness: aliasDecision.progressWitness,
    allowedEntityIds: catalog.findMatches(request.question)
      .filter(entry => catalog.isEntityMentionUnlocked(entry, request.reading))
      .map(entry => entry.id),
  };
}
