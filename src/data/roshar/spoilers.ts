import {
  EncyclopediaClaim,
  ReadingProgress,
  ReadingRequirement,
  SpoilerGate
} from './model';

/**
 * Builds a completion set only from unambiguous work records. Duplicate
 * persistence entries are treated as unknown state, so they cannot combine to
 * satisfy a spoiler gate. This mirrors the fail-closed policy used by reading
 * progress projections.
 */
function completedUnitsFromUnambiguousProgress(
  progress: readonly ReadingProgress[]
): ReadonlySet<string> {
  const counts = new Map<string, number>();
  for (const item of progress) {
    if (!item || typeof item.workId !== 'string' || !Array.isArray(item.completedUnitIds)) continue;
    counts.set(item.workId, (counts.get(item.workId) ?? 0) + 1);
  }

  const completed = new Set<string>();
  for (const item of progress) {
    if (!item || typeof item.workId !== 'string' || !Array.isArray(item.completedUnitIds)) continue;
    if (counts.get(item.workId) !== 1) continue;
    for (const unitId of item.completedUnitIds) {
      if (typeof unitId === 'string') completed.add(unitId);
    }
  }
  return completed;
}


/**
 * Evaluates one reading requirement against explicitly completed units.
 * A unit is never inferred as complete from a later chapter or a book flag.
 */
function requirementSatisfied(
  requirement: ReadingRequirement,
  completedUnitIds: ReadonlySet<string>,
  unitWorkById: ReadonlyMap<string, string>
): boolean {
  if (!requirement || !requirement.workId || !requirement.readingUnitId) return false;
  return (
    unitWorkById.get(requirement.readingUnitId) === requirement.workId &&
    completedUnitIds.has(requirement.readingUnitId)
  );
}

/**
 * Fail-closed spoiler gate evaluation.
 *
 * - Every allOf requirement must be completed.
 * - If anyOf is supplied, at least one of its requirements must be completed.
 * - Empty or malformed gates never reveal content.
 */
export function isSpoilerGateSatisfied(
  gate: SpoilerGate | null | undefined,
  completedUnitIds: ReadonlySet<string>,
  unitWorkById: ReadonlyMap<string, string>
): boolean {
  if (!gate || !Array.isArray(gate.allOf)) return false;
  if (gate.anyOf !== undefined && !Array.isArray(gate.anyOf)) return false;
  if (gate.allOf.length === 0 && (!gate.anyOf || gate.anyOf.length === 0)) return false;

  const allRequirementsMet = gate.allOf.every(requirement =>
    requirementSatisfied(requirement, completedUnitIds, unitWorkById)
  );
  if (!allRequirementsMet) return false;

  if (gate.anyOf && gate.anyOf.length > 0) {
    return gate.anyOf.some(requirement =>
      requirementSatisfied(requirement, completedUnitIds, unitWorkById)
    );
  }

  return true;
}

/**
 * Only published claims with a satisfied gate are returned to callers.
 * Draft/reviewed claims are intentionally excluded from public selectors.
 */
export function selectVisibleClaims(
  claims: EncyclopediaClaim[],
  progress: ReadingProgress[],
  unitWorkById: ReadonlyMap<string, string>
): EncyclopediaClaim[] {
  const completedUnitIds = completedUnitsFromUnambiguousProgress(progress);

  return claims.filter(claim =>
    !!claim &&
    claim.editorialStatus === 'published' &&
    Array.isArray(claim.sourceRefs) &&
    claim.sourceRefs.length > 0 &&
    isSpoilerGateSatisfied(claim.spoilerGate, completedUnitIds, unitWorkById)
  );
}

/**
 * Returns true only if every published claim for an entity is visible.
 * Prefer selectVisibleClaims for rendering partial entity profiles, because
 * entities can legitimately contain both unlocked and locked claims.
 */
export function isEntityFullyRevealed(
  claims: EncyclopediaClaim[],
  entityId: string,
  progress: ReadingProgress[],
  unitWorkById: ReadonlyMap<string, string>
): boolean {
  const entityClaims = claims.filter(claim =>
    claim.entityId === entityId && claim.editorialStatus === 'published'
  );
  if (entityClaims.length === 0) return false;

  const visibleIds = new Set(
    selectVisibleClaims(claims, progress, unitWorkById).map(claim => claim.id)
  );
  return entityClaims.every(claim => visibleIds.has(claim.id));
}


/**
 * Returns only visible claims belonging to one entity. Callers receive no
 * placeholder for an entity that has no currently visible claims.
 */
export function selectVisibleClaimsForEntity(
  claims: EncyclopediaClaim[],
  entityId: string,
  progress: ReadingProgress[],
  unitWorkById: ReadonlyMap<string, string>
): EncyclopediaClaim[] {
  if (!entityId) return [];
  return selectVisibleClaims(claims, progress, unitWorkById)
    .filter(claim => claim.entityId === entityId);
}

/**
 * Search projection over visible claim text only. Hidden claims are filtered
 * before matching, so a match cannot reveal a blocked description.
 * Entity names/aliases must be gated separately before being added to indexes.
 */
export function selectVisibleClaimsForSearch(
  claims: EncyclopediaClaim[],
  progress: ReadingProgress[],
  unitWorkById: ReadonlyMap<string, string>,
  query: string
): EncyclopediaClaim[] {
  if (typeof query !== 'string') return [];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  return selectVisibleClaims(claims, progress, unitWorkById)
    .filter(claim => typeof claim.text === 'string' && claim.text.toLocaleLowerCase().includes(normalizedQuery));
}
