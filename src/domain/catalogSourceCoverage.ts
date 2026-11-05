import type { WorldCatalogEntry } from "./cosmereCatalog";
import type { CatalogProvenance } from "./catalogProvenance";

export type CatalogSourceCoverageIssue =
  | { code: "missing_provenance"; workId: string }
  | { code: "provenance_for_unknown_work"; workId: string; sourceId: string };

/**
 * Ensures every declared catalog work has an explicit source link and that
 * provenance never points at a work absent from the catalog.
 *
 * This is intentionally a coverage check only: it does not guess sources,
 * titles, worlds, or reading structure when metadata is incomplete.
 */
export function validateCatalogSourceCoverage(
  worlds: readonly WorldCatalogEntry[],
  provenance: readonly CatalogProvenance[],
): readonly CatalogSourceCoverageIssue[] {
  const knownWorkIds = new Set(worlds.flatMap((world) => world.works.map((work) => work.id)));
  const linkedWorkIds = new Set(provenance.map((link) => link.workId));
  const issues: CatalogSourceCoverageIssue[] = [];

  for (const workId of knownWorkIds) {
    if (!linkedWorkIds.has(workId)) {
      issues.push({ code: "missing_provenance", workId });
    }
  }

  for (const link of provenance) {
    if (!knownWorkIds.has(link.workId)) {
      issues.push({
        code: "provenance_for_unknown_work",
        workId: link.workId,
        sourceId: link.sourceId,
      });
    }
  }

  return issues;
}
