import { isKnownSource } from "./sourceCatalog";

export type ReadingProgress = Readonly<Record<string, number>>;

export type NarrativeEvidence = {
  id: string;
  sourceId: string;
  chapter: number;
  summary: string;
  accessible: boolean;
};

export type SafeContext = {
  sourceId: string;
  maxChapter: number;
  evidence: NarrativeEvidence[];
};

/**
 * Builds narrative context with fail-closed spoiler protection.
 * Unknown sources, missing progress, future chapters and inaccessible evidence
 * are excluded. This function does not inspect or store copyrighted passage text.
 */
export function buildSafeContext(
  sourceId: string,
  progress: ReadingProgress,
  evidence: readonly NarrativeEvidence[],
): SafeContext | null {
  const maxChapter = progress[sourceId];
  if (!isKnownSource(sourceId) || !Number.isInteger(maxChapter) || maxChapter < 1) {
    return null;
  }

  const allowed = evidence.filter((item) =>
    item.sourceId === sourceId &&
    item.accessible &&
    Number.isInteger(item.chapter) &&
    item.chapter >= 1 &&
    item.chapter <= maxChapter &&
    item.summary.trim().length > 0,
  );

  return { sourceId, maxChapter, evidence: [...allowed] };
}
