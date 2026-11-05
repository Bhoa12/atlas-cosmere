import type { ReaderProgress, WorldCatalogEntry } from "./cosmereCatalog";
import { validateCatalog } from "./cosmereCatalog";
import {
  validateProgressBoundaries,
  type ProgressBoundaryIssue,
} from "./progressBoundaryValidation";

export type ExpansionIntegrityIssue =
  | { layer: "catalog"; message: string }
  | { layer: "progress"; issue: ProgressBoundaryIssue };

export interface ExpansionIntegrityInput {
  worlds: readonly WorldCatalogEntry[];
  progress: readonly ReaderProgress[];
}

/**
 * Validates catalog structure and reader progress together.
 *
 * This is deliberately a metadata-only boundary: it aggregates existing
 * validators and never creates works, units, or editorial unlock points.
 */
export function validateExpansionIntegrity(
  input: ExpansionIntegrityInput,
): readonly ExpansionIntegrityIssue[] {
  const works = input.worlds.flatMap((world) => world.works);

  return [
    ...validateCatalog(input.worlds).map((message) => ({
      layer: "catalog" as const,
      message,
    })),
    ...validateProgressBoundaries(works, input.progress).map((issue) => ({
      layer: "progress" as const,
      issue,
    })),
  ];
}
