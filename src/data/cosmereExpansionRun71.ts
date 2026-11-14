import {
  ReadingUnit,
  SourceRecord,
  WorkRecord,
  WorldRecord,
  acceptedProgress,
} from "./cosmereExpansionRun70";

/**
 * Provenance-aware expansion utilities.
 * This layer intentionally stores no protected prose and never derives
 * editorial facts from a title or a declared private source.
 */
export interface WorldWorkLink {
  worldId: string;
  workId: string;
  sourceId: string;
  relation: "explicit-metadata";
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}

export type GateDecision =
  | { allowed: true; pendingUnitIds: [] }
  | { allowed: false; reason: "invalid-requirements" | "incomplete-progress"; pendingUnitIds: string[] };

export interface CatalogAudit {
  valid: boolean;
  issues: string[];
}

export function auditWorldWorkLinks(
  links: WorldWorkLink[],
  worlds: WorldRecord[],
  works: WorkRecord[],
  sources: SourceRecord[],
): CatalogAudit {
  const worldIds = new Set(worlds.map(world => world.id));
  const workIds = new Set(works.map(work => work.id));
  const sourceIds = new Set(sources.map(source => source.id));
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const link of links) {
    const key = `${link.worldId}:${link.workId}`;
    if (!worldIds.has(link.worldId)) issues.push(`unknown-world:${link.worldId}`);
    if (!workIds.has(link.workId)) issues.push(`unknown-work:${link.workId}`);
    if (!sourceIds.has(link.sourceId)) issues.push(`unknown-source:${link.sourceId}`);
    if (seen.has(key)) issues.push(`duplicate-link:${key}`);
    seen.add(key);
  }

  return { valid: issues.length === 0, issues };
}

export function worksForWorld(
  worldId: string,
  links: WorldWorkLink[],
  works: WorkRecord[],
): WorkRecord[] {
  const ids = new Set(links.filter(link => link.worldId === worldId).map(link => link.workId));
  return works.filter(work => ids.has(work.id));
}

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  completedUnitIds: string[],
  units: ReadingUnit[],
): GateDecision {
  const workUnits = new Set(units.filter(unit => unit.workId === gate.workId).map(unit => unit.id));
  const uniqueRequirements = new Set(gate.requiredUnitIds);
  const invalid =
    gate.requiredUnitIds.length === 0 ||
    uniqueRequirements.size !== gate.requiredUnitIds.length ||
    gate.requiredUnitIds.some(id => !workUnits.has(id));

  if (invalid) return { allowed: false, reason: "invalid-requirements", pendingUnitIds: [] };

  const accepted = new Set(
    acceptedProgress({ workId: gate.workId, completedUnitIds }, units),
  );
  const pendingUnitIds = gate.requiredUnitIds.filter(id => !accepted.has(id));
  return pendingUnitIds.length === 0
    ? { allowed: true, pendingUnitIds: [] }
    : { allowed: false, reason: "incomplete-progress", pendingUnitIds };
}
