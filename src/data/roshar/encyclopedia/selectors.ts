import {
  EncyclopediaClaim,
  EncyclopediaEntity,
  ReadingProgress,
  SourceReference
} from '../model';
import {
  ROSHAR_READING_UNIT_WORK_BY_ID,
  ROSHAR_READING_UNITS
} from '../catalog/readingUnits';
import { selectVisibleClaims, selectVisibleClaimsForEntity } from '../spoilers';

export interface EncyclopediaEntityProjection {
  entity: EncyclopediaEntity;
  claims: EncyclopediaClaim[];
  fullyVisible: boolean;
}

/**
 * Public encyclopedia projection. Entities without an unlocked published claim
 * are omitted entirely so names and aliases cannot become spoiler indexes.
 */
export function selectVisibleEncyclopediaEntities(
  entities: readonly EncyclopediaEntity[],
  claims: readonly EncyclopediaClaim[],
  progress: readonly ReadingProgress[]
): EncyclopediaEntityProjection[] {
  if (!Array.isArray(entities) || !Array.isArray(claims) || !Array.isArray(progress)) return [];
  return entities.reduce<EncyclopediaEntityProjection[]>((result, entity) => {
    if (!entity || typeof entity.id !== 'string' || entity.id.trim().length === 0) return result;
    const visible = selectVisibleClaimsForEntity(
      [...claims],
      entity.id,
      [...progress],
      ROSHAR_READING_UNIT_WORK_BY_ID
    );
    if (visible.length === 0) return result;
    const published = claims.filter(claim =>
      claim.entityId === entity.id && claim.editorialStatus === 'published'
    );
    result.push({
      entity,
      claims: visible,
      fullyVisible: published.length > 0 && visible.length === published.length
    });
    return result;
  }, []);
}

export function selectVisibleEncyclopediaClaims(
  claims: readonly EncyclopediaClaim[],
  progress: readonly ReadingProgress[]
): EncyclopediaClaim[] {
  if (!Array.isArray(claims) || !Array.isArray(progress)) return [];
  return selectVisibleClaims([...claims], [...progress], ROSHAR_READING_UNIT_WORK_BY_ID);
}

export function validateEncyclopediaContent(
  entities: readonly EncyclopediaEntity[],
  claims: readonly EncyclopediaClaim[],
  sources: readonly SourceReference[]
): string[] {
  if (!Array.isArray(entities) || !Array.isArray(claims) || !Array.isArray(sources)) return ['Encyclopedia content contains malformed collections'];
  const issues: string[] = [];
  const entityIds = new Set(entities.filter(entity => entity && typeof entity.id === 'string').map(entity => entity.id));
  const validSources = sources.filter(source => source && typeof source.id === 'string');
  const sourceIds = new Set(validSources.map(source => source.id));
  const sourcesById = new Map(validSources.map(source => [source.id, source]));
  const unitIds = new Set(ROSHAR_READING_UNITS.map(unit => unit.id));

  for (const claim of claims) {
    if (!claim || typeof claim.id !== 'string' || typeof claim.entityId !== 'string' || !Array.isArray(claim.sourceRefs) || !claim.spoilerGate || !Array.isArray(claim.spoilerGate.allOf)) {
      issues.push('Encyclopedia content contains a malformed claim');
      continue;
    }
    if (!entityIds.has(claim.entityId)) issues.push('Claim ' + claim.id + ' references an unknown entity');
    if (claim.editorialStatus === 'published' && (typeof claim.text !== 'string' || !claim.text.trim())) issues.push('Published claim ' + claim.id + ' has no text');
    if (claim.editorialStatus === 'published' && claim.sourceRefs.length === 0) issues.push('Published claim ' + claim.id + ' has no source');
    if (claim.editorialStatus === 'published' && !claim.reviewedAt) issues.push('Published claim ' + claim.id + ' has not been reviewed');
    for (const sourceId of claim.sourceRefs) {
      if (!sourceIds.has(sourceId)) issues.push('Claim ' + claim.id + ' references an unknown source');
      const source = sourcesById.get(sourceId);
      if (claim.editorialStatus === 'published' && source?.sourceType === 'novel' && (!source.readingUnitId || !source.locator)) {
        issues.push('Published novel claim ' + claim.id + ' requires an exact source locator and reading unit');
      }
    }
    if (claim.spoilerGate.anyOf !== undefined && !Array.isArray(claim.spoilerGate.anyOf)) {
      issues.push('Claim ' + claim.id + ' has a malformed spoiler gate');
      continue;
    }
    const requirements = [...claim.spoilerGate.allOf, ...(claim.spoilerGate.anyOf ?? [])];
    if (requirements.length === 0) issues.push('Claim ' + claim.id + ' has an empty spoiler gate');
    for (const requirement of requirements) {
      if (!unitIds.has(requirement.readingUnitId)) issues.push('Claim ' + claim.id + ' references an unknown reading unit');
      if (ROSHAR_READING_UNIT_WORK_BY_ID.get(requirement.readingUnitId) !== requirement.workId) issues.push('Claim ' + claim.id + ' has a work/unit mismatch');
    }
  }
  return issues;
}
