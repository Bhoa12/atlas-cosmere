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
    if (!item || typeof item.workId !== 'string' || item.workId.trim().length === 0) continue;
    // Count every identifiable record, including malformed ones. Otherwise a
    // corrupt duplicate could be ignored and leave a valid sibling appearing
    // unambiguous, which would violate the fail-closed spoiler policy.
    counts.set(item.workId, (counts.get(item.workId) ?? 0) + 1);
  }

  const completed = new Set<string>();
  for (const item of progress) {
    if (!item || typeof item.workId !== 'string' || item.workId.trim().length === 0 || !Array.isArray(item.completedUnitIds)) continue;
    if (counts.get(item.workId) !== 1) continue;
    for (const unitId of item.completedUnitIds) {
      if (typeof unitId === 'string' && unitId.trim().length > 0) completed.add(unitId);
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
  if (
    !requirement ||
    typeof requirement.workId !== 'string' ||
    requirement.workId.trim().length === 0 ||
    typeof requirement.readingUnitId !== 'string' ||
    requirement.readingUnitId.trim().length === 0
  ) return false;
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
  if (!completedUnitIds || typeof (completedUnitIds as { has?: unknown }).has !== 'function') return false;
  if (!unitWorkById || typeof (unitWorkById as { get?: unknown }).get !== 'function') return false;
  const validRequirement = (requirement: ReadingRequirement | null | undefined): boolean =>
    !!requirement &&
    typeof requirement.workId === 'string' &&
    requirement.workId.trim().length > 0 &&
    typeof requirement.readingUnitId === 'string' &&
    requirement.readingUnitId.trim().length > 0;
  if (gate.allOf.some(requirement => !validRequirement(requirement))) return false;
  if (Array.isArray(gate.anyOf) && gate.anyOf.some(requirement => !validRequirement(requirement))) return false;
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
 * A malformed claim collection is treated as empty to preserve fail-closed
 * anti-spoiler behavior for persisted or imported runtime data.
 */
export function selectVisibleClaims(
  claims: EncyclopediaClaim[],
  progress: ReadingProgress[],
  unitWorkById: ReadonlyMap<string, string>
): EncyclopediaClaim[] {
  if (!Array.isArray(claims) || !Array.isArray(progress)) return [];
  const completedUnitIds = completedUnitsFromUnambiguousProgress(progress);
  const idCounts = new Map<string, number>();
  for (const claim of claims) {
    if (claim && typeof claim.id === 'string' && claim.id.trim().length > 0) {
      idCounts.set(claim.id, (idCounts.get(claim.id) ?? 0) + 1);
    }
  }

  return claims.filter(claim =>
    !!claim &&
    typeof claim.id === 'string' &&
    claim.id.trim().length > 0 &&
    idCounts.get(claim.id) === 1 &&
    typeof claim.entityId === 'string' &&
    claim.entityId.trim().length > 0 &&
    claim.editorialStatus === 'published' &&
    Array.isArray(claim.sourceRefs) &&
    claim.sourceRefs.length > 0 &&
    claim.sourceRefs.every(sourceRef => typeof sourceRef === 'string' && sourceRef.trim().length > 0) &&
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
  if (!Array.isArray(claims) || !Array.isArray(progress)) return false;
  if (typeof entityId !== 'string' || entityId.trim().length === 0) return false;
  const entityClaims = claims.filter(claim =>
    !!claim && typeof claim.entityId === 'string' &&
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
  if (!Array.isArray(claims) || !Array.isArray(progress)) return [];
  if (typeof entityId !== 'string' || entityId.trim().length === 0) return [];
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
  if (!Array.isArray(claims) || !Array.isArray(progress)) return [];
  if (typeof query !== 'string') return [];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  return selectVisibleClaims(claims, progress, unitWorkById)
    .filter(claim => typeof claim.text === 'string' && claim.text.toLocaleLowerCase().includes(normalizedQuery));
}
