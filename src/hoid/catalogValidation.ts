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

export function validatedKnowledge(entries: HoidKnowledgeEntry[]): HoidKnowledgeEntry[] {
  return entries.filter(isValidKnowledgeEntry);
}
