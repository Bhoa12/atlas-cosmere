/**
 * Contratos de dominio para la enciclopedia progresiva de Roshar.
 *
 * Este módulo no contiene contenido de las novelas. Los datos editoriales se
 * incorporan por separado y deben incluir referencias y límites de spoilers.
 */

export type ReadingUnitKind =
  | 'prologue'
  | 'chapter'
  | 'interlude'
  | 'epilogue'
  | 'appendix'
  | 'other';

export type EncyclopediaEntityType =
  | 'character'
  | 'location'
  | 'species'
  | 'flora'
  | 'culture'
  | 'phenomenon'
  | 'magicSystem'
  | 'object'
  | 'event'
  | 'concept';

export type EditorialConfidence =
  | 'confirmed'
  | 'inference'
  | 'disputed'
  | 'unknown';

export type EditorialStatus = 'draft' | 'reviewed' | 'published';

export interface RosharWork {
  id: string;
  planetId: 'roshar';
  seriesId: 'stormlight-archive';
  title: string;
  workType: 'novel' | 'novella' | 'short-story' | 'supplement';
  /** Null until verified against an authoritative publication bibliography. */
  publicationOrder: number | null;
  /** Separate from publication and in-world chronological order. */
  recommendedReadingOrder: number | null;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  ordinal: number;
  kind: ReadingUnitKind;
  label: string;
  chapterNumber?: number;
  /** Edition-specific structure must never be silently merged. */
  editionVariant?: string;
}

export interface ReadingRequirement {
  workId: string;
  readingUnitId: string;
}

export interface SpoilerGate {
  /** Every requirement in allOf must be completed. */
  allOf: ReadingRequirement[];
  /** If present, at least one requirement in anyOf must be completed. */
  anyOf?: ReadingRequirement[];
}

export interface EncyclopediaEntity {
  id: string;
  planetId: 'roshar';
  type: EncyclopediaEntityType;
  canonicalName: string;
  aliases: string[];
}

export interface SourceReference {
  id: string;
  sourceType:
    | 'novel'
    | 'official_author'
    | 'official_publisher'
    | 'official_reference';
  workId?: string;
  readingUnitId?: string;
  editionId?: string;
  locator?: string;
  notes?: string;
}

export interface EncyclopediaClaim {
  id: string;
  entityId: string;
  sectionKey: string;
  text: string;
  claimType: string;
  spoilerGate: SpoilerGate;
  sourceRefs: string[];
  confidence: EditorialConfidence;
  editorialStatus: EditorialStatus;
  reviewedAt?: string;
}

export interface ReadingProgress {
  workId: string;
  /** Explicitly completed units; gaps are meaningful and must be preserved. */
  completedUnitIds: string[];
  currentUnitId?: string;
  updatedAt: string;
}

export interface CatalogValidationIssue {
  code:
    | 'duplicate-id'
    | 'unknown-work'
    | 'invalid-ordinal'
    | 'duplicate-ordinal'
    | 'invalid-chapter-number'
    | 'invalid-spoiler-gate';
  message: string;
  itemId: string;
}

/**
 * Structural validation only. It deliberately does not invent missing units:
 * authoritative chapter lists and edition differences must be supplied first.
 */
export function validateReadingUnits(
  workIds: string[],
  units: ReadingUnit[]
): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const knownWorks = new Set(workIds);
  const seenIds = new Set<string>();
  const seenOrdinals = new Set<string>();

  for (const unit of units) {
    if (seenIds.has(unit.id)) {
      issues.push({
        code: 'duplicate-id',
        itemId: unit.id,
        message: `Reading unit ID is duplicated: ${unit.id}`
      });
    }
    seenIds.add(unit.id);

    if (!knownWorks.has(unit.workId)) {
      issues.push({
        code: 'unknown-work',
        itemId: unit.id,
        message: `Reading unit ${unit.id} references unknown work ${unit.workId}`
      });
    }

    if (!Number.isInteger(unit.ordinal) || unit.ordinal < 1) {
      issues.push({
        code: 'invalid-ordinal',
        itemId: unit.id,
        message: `Reading unit ${unit.id} must have a positive integer ordinal`
      });
    }

    const ordinalKey = `${unit.workId}:${unit.ordinal}`;
    if (seenOrdinals.has(ordinalKey)) {
      issues.push({
        code: 'duplicate-ordinal',
        itemId: unit.id,
        message: `Work ${unit.workId} has more than one unit at ordinal ${unit.ordinal}`
      });
    }
    seenOrdinals.add(ordinalKey);

    if (
      unit.kind === 'chapter' &&
      (!Number.isInteger(unit.chapterNumber) || (unit.chapterNumber ?? 0) < 1)
    ) {
      issues.push({
        code: 'invalid-chapter-number',
        itemId: unit.id,
        message: `Chapter unit ${unit.id} must have a positive chapterNumber`
      });
    }
  }

  return issues;
}

export function validateSpoilerGate(
  gate: SpoilerGate,
  knownUnitIds: Set<string>
): CatalogValidationIssue[] {
  const requirements = [...(gate?.allOf ?? []), ...(gate?.anyOf ?? [])];
  if (requirements.length === 0) {
    return [{
      code: 'invalid-spoiler-gate',
      itemId: 'unknown',
      message: 'A published claim must have at least one explicit reading requirement'
    }];
  }

  return requirements
    .filter(requirement => !knownUnitIds.has(requirement.readingUnitId))
    .map(requirement => ({
      code: 'invalid-spoiler-gate' as const,
      itemId: requirement.readingUnitId,
      message: `Spoiler gate references unknown reading unit ${requirement.readingUnitId}`
    }));
}
