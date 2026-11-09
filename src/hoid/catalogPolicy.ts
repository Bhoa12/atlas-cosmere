import {
  type HoidCatalogEntry,
  type HoidProgress,
  SpoilerPolicy,
  canonicalCatalog,
  catalogBoundProgress,
} from "./contracts";

/**
 * Creates a spoiler policy whose reading progress is restricted to a verified
 * catalog before any authorization decision is made.
 *
 * This adapter keeps catalog trust separate from provider integrations: callers
 * supply metadata only, while narrative knowledge continues to pass through
 * AuthorizedKnowledgeRetriever and SpoilerPolicy.
 */
export function createCatalogBoundSpoilerPolicy(
  progress: unknown,
  catalog: readonly HoidCatalogEntry[],
): SpoilerPolicy {
  const catalogIds = canonicalCatalog(catalog);
  const trustedProgress: HoidProgress = catalogBoundProgress(progress, catalogIds);
  return new SpoilerPolicy(trustedProgress);
}
