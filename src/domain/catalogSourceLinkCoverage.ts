import type { WorldCatalogEntry } from "./cosmereCatalog";
import type { BibliographicSourceEntry } from "./privateCosmereSourceCatalog";
import type { CatalogSourceLink } from "./catalogSourceLinks";

export interface CatalogSourceLinkCoverage {
  linkedWorkIds: readonly string[];
  unlinkedWorkIds: readonly string[];
  missingSourceIds: readonly string[];
  ambiguousSourceIds: readonly string[];
}

/**
 * Summarizes structural provenance coverage without asserting editorial
 * verification. Unknown, missing, or ambiguous links are reported explicitly
 * and never treated as evidence for a work.
 */
export function summarizeCatalogSourceLinkCoverage(
  worlds: readonly WorldCatalogEntry[],
  links: readonly CatalogSourceLink[],
  sources: readonly BibliographicSourceEntry[],
): CatalogSourceLinkCoverage {
  const workIds = worlds.flatMap((world) => world.works.map((work) => work.id));
  const knownWorks = new Set(workIds);
  const sourceCounts = new Map<string, number>();

  for (const source of sources) {
    sourceCounts.set(source.sourceId, (sourceCounts.get(source.sourceId) ?? 0) + 1);
  }

  const linked = new Set<string>();
  const missing = new Set<string>();
  const ambiguous = new Set<string>();

  for (const link of links) {
    if (!knownWorks.has(link.workId)) continue;

    const count = sourceCounts.get(link.sourceId) ?? 0;
    if (count === 1) linked.add(link.workId);
    else if (count === 0) missing.add(link.sourceId);
    else ambiguous.add(link.sourceId);
  }

  return {
    linkedWorkIds: [...linked].sort(),
    unlinkedWorkIds: workIds.filter((workId) => !linked.has(workId)).sort(),
    missingSourceIds: [...missing].sort(),
    ambiguousSourceIds: [...ambiguous].sort(),
  };
}
