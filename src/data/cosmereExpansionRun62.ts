import type { Catalog, ReadingProgress, ReadingUnit, SpoilerGate } from './cosmereExpansionRun61';
import { canReveal, normalizeProgress } from './cosmereExpansionRun61';

export type RevealDecisionCode =
  | 'revealed'
  | 'missing-progress'
  | 'wrong-work'
  | 'empty-requirements'
  | 'duplicate-requirements'
  | 'unknown-or-foreign-requirement'
  | 'incomplete-progress';

export interface RevealDecision {
  allowed: boolean;
  code: RevealDecisionCode;
  completedUnitIds: string[];
  missingUnitIds: string[];
}

export interface WorldWorkRelation {
  worldId: string;
  workId: string;
  sourceId: string;
}

export interface RelationIssue { code: 'unknown-world' | 'unknown-work' | 'unknown-source' | 'duplicate-relation'; index: number; }

/**
 * Explains a spoiler decision without exposing editorial content.
 * The decision remains fail-closed and is derived only from IDs and progress.
 */
export function evaluateReveal(
  gate: SpoilerGate,
  progress: ReadingProgress | undefined,
  units: ReadingUnit[],
): RevealDecision {
  if (!progress) return { allowed: false, code: 'missing-progress', completedUnitIds: [], missingUnitIds: [...gate.requiredUnitIds] };
  if (progress.workId !== gate.workId) return { allowed: false, code: 'wrong-work', completedUnitIds: [], missingUnitIds: [...gate.requiredUnitIds] };
  if (gate.requiredUnitIds.length === 0) return { allowed: false, code: 'empty-requirements', completedUnitIds: [], missingUnitIds: [] };
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return { allowed: false, code: 'duplicate-requirements', completedUnitIds: [], missingUnitIds: [...gate.requiredUnitIds] };

  const byId = new Map(units.map(unit => [unit.id, unit]));
  if (gate.requiredUnitIds.some(id => byId.get(id)?.workId !== gate.workId)) {
    return { allowed: false, code: 'unknown-or-foreign-requirement', completedUnitIds: [], missingUnitIds: [...gate.requiredUnitIds] };
  }

  const normalized = normalizeProgress(progress, units);
  const completed = new Set(normalized.completedUnitIds);
  const missing = gate.requiredUnitIds.filter(id => !completed.has(id));
  if (missing.length > 0) return { allowed: false, code: 'incomplete-progress', completedUnitIds: normalized.completedUnitIds, missingUnitIds: missing };

  return {
    allowed: canReveal(gate, progress, units),
    code: 'revealed',
    completedUnitIds: normalized.completedUnitIds,
    missingUnitIds: [],
  };
}

/**
 * Relations are accepted only when every referenced catalog record exists.
 * This deliberately does not infer world membership from titles.
 */
export function validateWorldWorkRelations(catalog: Catalog, relations: WorldWorkRelation[]): RelationIssue[] {
  const worldIds = new Set(catalog.worlds.map(world => world.id));
  const workIds = new Set(catalog.works.map(work => work.id));
  const sourceIds = new Set(catalog.sources.map(source => source.id));
  const seen = new Set<string>();
  const issues: RelationIssue[] = [];

  relations.forEach((relation, index) => {
    if (!worldIds.has(relation.worldId)) issues.push({ code: 'unknown-world', index });
    if (!workIds.has(relation.workId)) issues.push({ code: 'unknown-work', index });
    if (!sourceIds.has(relation.sourceId)) issues.push({ code: 'unknown-source', index });
    const key = relation.worldId + ':' + relation.workId + ':' + relation.sourceId;
    if (seen.has(key)) issues.push({ code: 'duplicate-relation', index });
    seen.add(key);
  });

  return issues;
}
