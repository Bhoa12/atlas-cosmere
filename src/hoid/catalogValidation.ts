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
 * Return detached, canonical entries using the exact same bibliography,
 * edition-manifest, alias, size, descriptor and duplicate-ID rules as
 * HoidKnowledgeCatalog. Invalid outer collections fail closed as a whole.
 */
export function validatedKnowledge(
  entries: readonly HoidKnowledgeEntry[],
): HoidKnowledgeEntry[] {
  return canonicalizeHoidKnowledgeEntries(entries);
}
