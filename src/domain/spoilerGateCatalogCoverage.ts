import type { CompositeSpoilerGate } from "./compositeSpoilerGates";
import type { WorldCatalogEntry } from "./cosmereCatalog";

export type SpoilerGateCatalogIssue =
  | { code: "unknown_work"; gateId: string; workId: string }
  | { code: "undeclared_position"; gateId: string; workId: string; requiredPosition: number };

/**
 * Cross-checks explicit spoiler requirements against the reading coordinates
 * actually declared in the catalog. It never rounds, clamps, or infers a
 * checkpoint: a missing coordinate keeps the requirement invalid.
 */
export function validateSpoilerGateCatalogCoverage(
  worlds: readonly WorldCatalogEntry[],
  gates: readonly CompositeSpoilerGate[],
): readonly SpoilerGateCatalogIssue[] {
  const works = new Map(
    worlds.flatMap((world) => world.works.map((work) => [work.id, work] as const)),
  );
  const issues: SpoilerGateCatalogIssue[] = [];

  for (const gate of gates) {
    for (const requirement of gate.requirements) {
      const work = works.get(requirement.workId);
      if (!work) {
        issues.push({ code: "unknown_work", gateId: gate.id, workId: requirement.workId });
        continue;
      }

      if (!work.units.some((unit) => unit.order === requirement.requiredPosition)) {
        issues.push({
          code: "undeclared_position",
          gateId: gate.id,
          workId: requirement.workId,
          requiredPosition: requirement.requiredPosition,
        });
      }
    }
  }

  return issues;
}
