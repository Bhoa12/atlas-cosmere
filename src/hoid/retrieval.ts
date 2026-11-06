import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";

function questionTerms(question: string): string[] {
  return question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Returns only knowledge already unlocked by the reader and relevant to the
 * current question. Relevance is deliberately conservative: multi-word
 * aliases may match the normalized question as a phrase, while single-word
 * aliases match normalized question tokens.
 */
export function retrieveAuthorized(
  items: HoidKnowledgeEntry[],
  progress: ReadingPosition[],
  question: string,
): HoidKnowledgeEntry[] {
  const catalog = new HoidKnowledgeCatalog(items);
  const authorized = items.filter(item => catalog.isUnlocked(item, progress));
  const normalizedQuestion = question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const terms = questionTerms(question);

  return authorized.filter(item => {
    if (terms.length === 0) return false;
    return item.aliases.some(alias => {
      const normalizedAlias = alias
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
      if (!normalizedAlias) return false;
      return normalizedAlias.includes(" ")
        ? normalizedQuestion.includes(normalizedAlias)
        : terms.includes(normalizedAlias);
    });
  });
}
