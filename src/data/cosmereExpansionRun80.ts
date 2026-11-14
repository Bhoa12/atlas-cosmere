/**
 * Run 80: pure navigation helpers for the Cosmere catalog.
 * This module contains metadata logic only. It does not contain editorial text.
 */

export type CatalogSourceKind =
  | "verified-index"
  | "declared-private"
  | "editorial-accessible";

export interface CatalogSource {
  id: string;
  kind: CatalogSourceKind;
  accessible: boolean;
}

export interface CatalogWorld {
  id: string;
  name: string;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface WorldWorkLink {
  worldId: string;
  workId: string;
  sourceId: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
}

export interface ProgressSnapshot {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}

export function sourceCanBackReadingStructure(source: CatalogSource): boolean {
  return source.kind === "editorial-accessible" && source.accessible;
}

export function worksForWorld(
  worldId: string,
  links: readonly WorldWorkLink[],
  works: readonly CatalogWork[],
): CatalogWork[] {
  const workIds = new Set(
    links.filter((link) => link.worldId === worldId).map((link) => link.workId),
  );
  return works.filter((work) => workIds.has(work.id));
}

export function reconcileProgress(
  workId: string,
  snapshots: readonly ProgressSnapshot[],
  units: readonly ReadingUnit[],
): string[] {
  const valid = new Map(
    units.filter((unit) => unit.workId === workId).map((unit) => [unit.id, unit]),
  );
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (valid.has(id)) completed.add(id);
  }
  return [...completed].sort((a, b) => valid.get(a)!.position - valid.get(b)!.position);
}

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  snapshots: readonly ProgressSnapshot[],
  units: readonly ReadingUnit[],
): { unlocked: boolean; pendingUnitIds: string[] } {
  const required = gate.requiredUnitIds;
  if (required.length === 0 || new Set(required).size !== required.length) {
    return { unlocked: false, pendingUnitIds: [...required] };
  }
  const validIds = new Set(units.filter((unit) => unit.workId === gate.workId).map((unit) => unit.id));
  if (required.some((id) => !validIds.has(id))) {
    return { unlocked: false, pendingUnitIds: [...required] };
  }
  const completed = new Set(reconcileProgress(gate.workId, snapshots, units));
  const pendingUnitIds = required.filter((id) => !completed.has(id));
  return { unlocked: pendingUnitIds.length === 0, pendingUnitIds };
}
