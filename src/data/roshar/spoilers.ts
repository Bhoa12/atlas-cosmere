import {
  EncyclopediaClaim,
  ReadingProgress,
  ReadingRequirement,
  SpoilerGate
} from './model';

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
  const completedUnitIds = new Set(
    progress.flatMap(item => item.completedUnitIds)
  );

  return claims.filter(claim =>
    claim.editorialStatus === 'published' &&
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
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  return selectVisibleClaims(claims, progress, unitWorkById)
    .filter(claim => claim.text.toLocaleLowerCase().includes(normalizedQuery));
}
