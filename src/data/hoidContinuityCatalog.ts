/**
 * Canonical continuity catalog contract for Hoid IA.
 *
 * Entries intentionally store only original metadata: an entity identifier,
 * aliases, kind and the earliest safe reading position. Narrative text belongs
 * in Atlas-authored summaries, never in this index.
 */
export type ReadingPosition = {
  bookId: string;
  chapter: number;
};

export type ContinuityKind =
  | "character"
  | "location"
  | "event"
  | "concept"
  | "magic"
  | "organization"
  | "object";

export type ContinuityEntry = {
  id: string;
  aliases: string[];
  kind: ContinuityKind;
  firstSafeAppearance: ReadingPosition;
};

export type ReaderProgress = Record<string, number>;

export function hasReached(
  progress: ReaderProgress,
  position: ReadingPosition,
): boolean {
  return (progress[position.bookId] ?? 0) >= position.chapter;
}

export function isEntrySafe(
  entry: ContinuityEntry,
  progress: ReaderProgress,
): boolean {
  return hasReached(progress, entry.firstSafeAppearance);
}

export function findEntries(
  query: string,
  entries: readonly ContinuityEntry[],
): ContinuityEntry[] {
  const normalized = query.trim().toLocaleLowerCase("es");
  if (!normalized) return [];

  return entries.filter((entry) =>
    [entry.id, ...entry.aliases].some((candidate) =>
      candidate.toLocaleLowerCase("es").includes(normalized),
    ),
  );
}

/**
 * Returns every matching entry that the current reader has not yet unlocked.
 * Hoid can use this before retrieval and again before rendering a provider
 * answer. An empty result does not prove that arbitrary prose is spoiler-free;
 * provider output still requires the response guard.
 */
export function getLockedMatches(
  query: string,
  entries: readonly ContinuityEntry[],
  progress: ReaderProgress,
): ContinuityEntry[] {
  return findEntries(query, entries).filter(
    (entry) => !isEntrySafe(entry, progress),
  );
}
