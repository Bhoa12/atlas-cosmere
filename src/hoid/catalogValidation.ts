import { HoidKnowledgeEntry } from "./catalog";

function canonicalKnowledgeId(id: string): string {
  return id.normalize("NFKC").trim().toLowerCase();
}

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
 * first occurrence to win. Identity comparison is normalized with NFKC,
 * trimming and case-folding so visually equivalent IDs cannot bypass this
 * boundary through whitespace, compatibility Unicode or capitalization.
 */
export function validatedKnowledge(entries: HoidKnowledgeEntry[]): HoidKnowledgeEntry[] {
  const validEntries = entries.filter(isValidKnowledgeEntry);
  const counts = new Map<string, number>();

  for (const entry of validEntries) {
    const id = canonicalKnowledgeId(entry.id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return validEntries.filter(entry => counts.get(canonicalKnowledgeId(entry.id)) === 1);
}
