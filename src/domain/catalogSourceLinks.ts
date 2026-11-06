import type { WorldCatalogEntry } from "./cosmereCatalog";
import type { BibliographicSourceEntry } from "./privateCosmereSourceCatalog";

export interface CatalogSourceLink {
  workId: string;
  sourceId: string;
}

export type CatalogSourceLinkIssueCode =
  | "unknown_work"
  | "duplicate_work_link"
  | "unknown_source"
  | "ambiguous_source";

export interface CatalogSourceLinkIssue {
  code: CatalogSourceLinkIssueCode;
  workId?: string;
  sourceId?: string;
}

/**
 * Validates only structural provenance links between catalog works and declared
 * bibliographic sources. A valid link proves neither that the source was read
 * nor that any editorial fact has been extracted from it.
 */
export function validateCatalogSourceLinks(
  worlds: readonly WorldCatalogEntry[],
  links: readonly CatalogSourceLink[],
  sources: readonly BibliographicSourceEntry[],
): readonly CatalogSourceLinkIssue[] {
  const knownWorks = new Set(worlds.flatMap((world) => world.works.map((work) => work.id)));
  const sourceCounts = new Map<string, number>();
  for (const source of sources) {
    sourceCounts.set(source.sourceId, (sourceCounts.get(source.sourceId) ?? 0) + 1);
  }

  const seenWorks = new Set<string>();
  const issues: CatalogSourceLinkIssue[] = [];
  for (const link of links) {
    if (!knownWorks.has(link.workId)) {
      issues.push({ code: "unknown_work", workId: link.workId, sourceId: link.sourceId });
      continue;
    }
    if (seenWorks.has(link.workId)) {
      issues.push({ code: "duplicate_work_link", workId: link.workId, sourceId: link.sourceId });
    }
    seenWorks.add(link.workId);

    const count = sourceCounts.get(link.sourceId) ?? 0;
    if (count === 0) {
      issues.push({ code: "unknown_source", workId: link.workId, sourceId: link.sourceId });
    } else if (count > 1) {
      issues.push({ code: "ambiguous_source", workId: link.workId, sourceId: link.sourceId });
    }
  }
  return issues;
}
