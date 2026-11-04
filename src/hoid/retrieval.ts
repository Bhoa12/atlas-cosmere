import { HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";
export function retrieveAuthorized(items: HoidKnowledgeEntry[], progress: ReadingPosition[], question: string): HoidKnowledgeEntry[] {
  const terms = question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return items.filter(item => {
    const p = progress.find(x => x.bookId === item.firstSafeAppearance.bookId);
    return !!p && (p.completed || (p.chapter ?? 0) >= item.firstSafeAppearance.chapter) &&
      (terms.length === 0 || item.aliases.some(a => terms.includes(a.toLowerCase())));
  });
}