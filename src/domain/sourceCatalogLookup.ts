import type { BibliographicSourceEntry } from "./privateCosmereSourceCatalog";

/**
 * Safe lookup helpers for bibliographic source metadata.
 *
 * A result is returned only when the requested identifier or title resolves to
 * exactly one declared source. Ambiguous or missing requests fail closed.
 */
export function findUniqueDeclaredSourceById(
  sources: readonly BibliographicSourceEntry[],
  sourceId: string,
): BibliographicSourceEntry | null {
  const matches = sources.filter(
    (source) => source.availability === "declared" && source.sourceId === sourceId,
  );
  return matches.length === 1 ? matches[0] : null;
}

export function findUniqueDeclaredSourceByTitle(
  sources: readonly BibliographicSourceEntry[],
  title: string,
): BibliographicSourceEntry | null {
  const matches = sources.filter(
    (source) => source.availability === "declared" && source.title === title,
  );
  return matches.length === 1 ? matches[0] : null;
}
