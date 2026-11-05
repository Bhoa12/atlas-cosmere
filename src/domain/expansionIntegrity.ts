import type { ReaderProgress, WorldCatalogEntry } from "./cosmereCatalog";
import type { CatalogProvenance } from "./catalogProvenance";
import { validateCatalog } from "./cosmereCatalog";
import { validateProgressBoundaries, type ProgressBoundaryIssue } from "./progressBoundaryValidation";
import { validateCatalogSourceCoverage, type CatalogSourceCoverageIssue } from "./catalogSourceCoverage";
import { validateWorkSequences, type WorkSequenceIssue } from "./workSequenceValidation";

export type ExpansionIntegrityIssue =
  | { layer: "catalog"; message: string }
  | { layer: "progress"; issue: ProgressBoundaryIssue }
  | { layer: "provenance"; issue: CatalogSourceCoverageIssue }
  | { layer: "sequence"; issue: WorkSequenceIssue };

export interface ExpansionIntegrityInput {
  worlds: readonly WorldCatalogEntry[];
  progress: readonly ReaderProgress[];
  provenance?: readonly CatalogProvenance[];
}

/**
 * Runs metadata-only integrity checks across the reusable expansion model.
 * Optional provenance enables source coverage checks without requiring callers
 * to invent source links when a provenance registry is unavailable.
 */
export function validateExpansionIntegrity(input: ExpansionIntegrityInput): readonly ExpansionIntegrityIssue[] {
  const works = input.worlds.flatMap((world) => world.works);
  const issues: ExpansionIntegrityIssue[] = [
    ...validateCatalog(input.worlds).map((message) => ({ layer: "catalog" as const, message })),
    ...validateWorkSequences(works).map((issue) => ({ layer: "sequence" as const, issue })),
    ...validateProgressBoundaries(works, input.progress).map((issue) => ({ layer: "progress" as const, issue })),
  ];

  if (input.provenance) {
    issues.push(
      ...validateCatalogSourceCoverage(input.worlds, input.provenance).map(
        (issue) => ({ layer: "provenance" as const, issue }),
      ),
    );
  }

  return issues;
}
