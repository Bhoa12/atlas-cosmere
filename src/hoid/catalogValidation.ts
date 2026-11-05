import { HoidKnowledgeEntry } from "./catalog";

/**
 * Catalog entries are an authorization boundary. Invalid metadata must never
 * reach retrieval or a provider because it cannot be safely unlocked.
 */
export function isValidKnowledgeEntry(entry: HoidKnowledgeEntry): boolean {
  const unlock = entry.unlock;
  return Boolean(
    entry.id?.trim() &&
    unlock?.bookId?.trim() &&
    Number.isFinite(unlock.chapter) &&
    unlock.chapter >= 0,
  );
}

export function validatedKnowledge(entries: HoidKnowledgeEntry[]): HoidKnowledgeEntry[] {
  return entries.filter(isValidKnowledgeEntry);
}
