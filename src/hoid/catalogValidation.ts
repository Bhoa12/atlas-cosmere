import { HoidKnowledgeEntry } from "./catalog";

/**
 * Catalog entries cross an authorization boundary. Validate the structural
 * metadata needed to identify and unlock knowledge before it can reach
 * retrieval or a provider.
 */
export function isValidKnowledgeEntry(entry: HoidKnowledgeEntry): boolean {
  const unlock = entry.firstSafeAppearance;
  const aliases = entry.aliases;

  return Boolean(
    entry.id?.trim() &&
    unlock?.bookId?.trim() &&
    Number.isFinite(unlock.chapter) &&
    unlock.chapter >= 0 &&
    Number.isInteger(unlock.chapter) &&
    Array.isArray(aliases) &&
    aliases.some(alias => typeof alias === "string" && alias.trim().length > 0),
  );
}

/**
 * Return only structurally valid entries with unambiguous identities.
 *
 * Duplicate knowledge IDs are rejected as a group rather than allowing the
 * first occurrence to win. A first-wins policy would make authorization depend
 * on catalog ordering and could associate evidence with the wrong metadata.
 */
export function validatedKnowledge(entries: HoidKnowledgeEntry[]): HoidKnowledgeEntry[] {
  const validEntries = entries.filter(isValidKnowledgeEntry);
  const counts = new Map<string, number>();

  for (const entry of validEntries) {
    const id = entry.id.trim();
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return validEntries.filter(entry => counts.get(entry.id.trim()) === 1);
}
