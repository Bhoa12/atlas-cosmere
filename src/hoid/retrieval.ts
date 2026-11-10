import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";

function normalizeForRetrieval(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\p{Cf}\p{Mn}]/gu, "")
    .toLowerCase();
}

function questionTerms(question: string): string[] {
  return normalizeForRetrieval(question)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsAlias(text: string, alias: string): boolean {
  const expression = new RegExp(
    "(^|[^\\p{L}\\p{N}])" + escapeRegexLiteral(alias) + "($|[^\\p{L}\\p{N}])",
    "u",
  );
  return expression.test(text);
}

/**
 * Returns only knowledge that has passed every editorial authorization gate:
 * verified provenance, an original summary and the reader's current position.
 * Relevance uses the same Unicode-aware lexical boundary policy as catalog
 * spoiler matching, so an alias cannot enter provider context merely because it
 * appears as a substring inside an unrelated word.
 */
export function retrieveAuthorized(
  items: HoidKnowledgeEntry[],
  progress: ReadingPosition[],
  question: string,
): HoidKnowledgeEntry[] {
  const catalog = new HoidKnowledgeCatalog(items);
  // entriesForContext is stricter than simple reading authorization. Never let
  // unlocked-but-limited or unavailable material cross into provider context.
  const authorized = catalog.entriesForContext(progress);
  const normalizedQuestion = normalizeForRetrieval(question);
  const terms = questionTerms(question);

  return authorized.filter(item => {
    if (terms.length === 0) return false;
    return item.aliases.some(alias => {
      const normalizedAlias = normalizeForRetrieval(alias).trim();
      if (!normalizedAlias) return false;
      return normalizedAlias.includes(" ")
        ? containsAlias(normalizedQuestion, normalizedAlias)
        : terms.includes(normalizedAlias);
    });
  });
}
