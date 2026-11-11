import { HoidKnowledgeEntry } from "./catalog";

/**
 * Provider-facing context boundary. Limits are applied after authorization and
 * retrieval so a broad question cannot accidentally send an unbounded amount of
 * otherwise authorized knowledge to an external provider.
 *
 * Both entry count and metadata character volume are bounded. A single
 * unexpectedly large editorial summary must not bypass the context boundary
 * merely because the number of entries is small.
 *
 * The provider receives a detached snapshot rather than references to the
 * catalog's mutable metadata. This keeps provider-side mutation from changing
 * the knowledge set reused by later requests.
 */
export const DEFAULT_MAX_CONTEXT_ENTRIES = 12;
export const DEFAULT_MAX_CONTEXT_CHARACTERS = 12_000;

/**
 * Count the fields that actually cross the provider boundary. Provider
 * snapshots intentionally omit retrieval aliases, so aliases stay local and
 * must not consume the external payload budget.
 */
function contextCharacterCost(entry: HoidKnowledgeEntry): number {
  return entry.id.length
    + entry.kind.length
    + (typeof entry.summary === "string" ? entry.summary.length : 0)
    + entry.firstSafeAppearance.bookId.length
    + String(entry.firstSafeAppearance.chapter).length;
}

export function boundAuthorizedContext(
  entries: HoidKnowledgeEntry[],
  maxEntries = DEFAULT_MAX_CONTEXT_ENTRIES,
  maxCharacters = DEFAULT_MAX_CONTEXT_CHARACTERS,
): HoidKnowledgeEntry[] {
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) return [];
  if (!Number.isFinite(maxCharacters) || maxCharacters <= 0) return [];

  const limit = Math.floor(maxEntries);
  const characterLimit = Math.floor(maxCharacters);
  const context: HoidKnowledgeEntry[] = [];
  let usedCharacters = 0;

  for (const entry of entries) {
    if (context.length >= limit) break;

    const cost = contextCharacterCost(entry);
    if (!Number.isFinite(cost) || cost < 0) continue;
    if (cost > characterLimit - usedCharacters) continue;

    context.push({
      ...entry,
      aliases: [...entry.aliases],
      firstSafeAppearance: { ...entry.firstSafeAppearance },
    });
    usedCharacters += cost;
  }

  return context;
}
