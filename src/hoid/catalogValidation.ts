import {
  canonicalizeHoidKnowledgeEntries,
  canonicalizeHoidKnowledgeEntry,
  type HoidKnowledgeEntry,
} from "./catalog";

/**
 * Validate one entry through the catalog's canonical authorization boundary.
 * This is intentionally not a second, weaker implementation of the schema.
 * Malformed optional evidence is downgraded to name-only metadata by the
 * canonicalizer and therefore cannot authorize a provider-facing summary.
 */
export function isValidKnowledgeEntry(entry: HoidKnowledgeEntry): boolean {
  return canonicalizeHoidKnowledgeEntry(entry) !== null;
}

/**
 * Return detached, canonical ingestion metadata using the exact same
 * bibliography, edition-manifest, alias, size, descriptor and duplicate-ID
 * rules as HoidKnowledgeCatalog. Invalid outer collections fail closed as a
 * whole. This helper has no reader-progress argument and does not authorize
 * disclosure; presentation must use HoidKnowledgeCatalog.entriesForContext().
 */
export function validatedKnowledge(
  entries: readonly HoidKnowledgeEntry[],
): HoidKnowledgeEntry[] {
  return canonicalizeHoidKnowledgeEntries(entries);
}
