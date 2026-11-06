import { HoidKnowledgeEntry } from "./catalog";

/**
 * Provider-facing context boundary. Limits are applied after authorization and
 * retrieval so a broad question cannot accidentally send an unbounded amount of
 * otherwise authorized knowledge to an external provider.
 *
 * The provider receives a detached snapshot rather than references to the
 * catalog's mutable metadata. This keeps provider-side mutation from changing
 * the knowledge set reused by later requests.
 */
export function boundAuthorizedContext(
  entries: HoidKnowledgeEntry[],
  maxEntries = 12,
): HoidKnowledgeEntry[] {
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) return [];

  return entries.slice(0, Math.floor(maxEntries)).map(entry => ({
    ...entry,
    aliases: [...entry.aliases],
    firstSafeAppearance: { ...entry.firstSafeAppearance },
  }));
}
