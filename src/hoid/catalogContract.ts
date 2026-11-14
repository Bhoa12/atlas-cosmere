/**
 * Bibliographic catalog contract for Hoid IA.
 *
 * A catalog entry describes a private source without turning the source's
 * narrative text into retrievable evidence. Narrative evidence must be created
 * separately and pass the context-selection pipeline.
 */

export type HoidCatalogSource = {
  sourceId: string;
  title: string;
  bookIds: readonly string[];
  access: "private";
};

export type CatalogValidation = {
  accepted: readonly HoidCatalogSource[];
  rejected: readonly HoidCatalogSource[];
};

function normalized(value: string): string {
  return value.trim();
}

/**
 * Fails closed for malformed or duplicate source identifiers. The catalog keeps
 * bibliographic structure only: it deliberately has no field for source text,
 * excerpts, or generated facts.
 */
export function validateCatalog(
  sources: readonly HoidCatalogSource[],
): CatalogValidation {
  const seen = new Set<string>();
  const accepted: HoidCatalogSource[] = [];
  const rejected: HoidCatalogSource[] = [];

  for (const source of sources) {
    const sourceId = normalized(source.sourceId);
    const title = normalized(source.title);
    const books = [...new Set(source.bookIds.map(normalized).filter(Boolean))];

    if (
      source.access !== "private" ||
      !sourceId ||
      !title ||
      books.length === 0 ||
      seen.has(sourceId)
    ) {
      rejected.push(source);
      continue;
    }

    seen.add(sourceId);
    accepted.push(
      Object.freeze({
        sourceId,
        title,
        bookIds: Object.freeze(books),
        access: "private" as const,
      }),
    );
  }

  return Object.freeze({
    accepted: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
  });
}

/**
 * Catalog membership is intentionally not an authorization mechanism.
 */
export function catalogContainsBook(
  catalog: readonly HoidCatalogSource[],
  bookId: string,
): boolean {
  const id = normalized(bookId);
  return Boolean(id) && catalog.some((source) => source.bookIds.includes(id));
}
