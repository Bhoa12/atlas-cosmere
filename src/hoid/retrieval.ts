import { KnowledgeItem, ReadingProgress, SourceId } from "./types";

export function isUnlocked(item: KnowledgeItem, progress: ReadingProgress[]): boolean {
  const p = progress.find(x => x.sourceId === item.sourceId);
  return !!p && p.chapter >= item.unlockChapter;
}

export function retrieveAuthorized(
  items: KnowledgeItem[], progress: ReadingProgress[], question: string
): KnowledgeItem[] {
  const terms = question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return items.filter(item =>
    isUnlocked(item, progress) &&
    (terms.length === 0 || item.tags.some(tag => terms.includes(tag.toLowerCase())))
  );
}

export function assertKnownSource(sourceId: string): asserts sourceId is SourceId {
  // Runtime source validation belongs at ingestion boundaries.
  if (!sourceId) throw new Error("Missing source id");
}
