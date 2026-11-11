import type { SourceCatalogEntry } from './cosmereExpansionCatalog';

/**
 * Runtime validation for bibliographic metadata.
 *
 * This boundary validates only technical catalog shape. It does not establish
 * editorial relationships, chronology, summaries, or narrative facts.
 */
export type SourceCatalogValidationReason =
  | 'invalid_collection_shape'
  | 'invalid_entry_shape'
  | 'invalid_id'
  | 'invalid_title'
  | 'invalid_source_collection'
  | 'invalid_world_ids'
  | 'duplicate_id';

export type SourceCatalogValidationResult =
  | { valid: true }
  | { valid: false; reason: SourceCatalogValidationReason; index?: number };

const SOURCE_COLLECTIONS = new Set(['cosmere.epub', 'roshar-private-epubs']);

function isCanonicalNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

export function validateSourceCatalog(
  catalog: unknown,
): SourceCatalogValidationResult {
  if (!Array.isArray(catalog)) {
    return { valid: false, reason: 'invalid_collection_shape' };
  }

  const ids = new Set<string>();

  for (let index = 0; index < catalog.length; index += 1) {
    const entry = catalog[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { valid: false, reason: 'invalid_entry_shape', index };
    }

    const candidate = entry as Partial<SourceCatalogEntry>;

    if (!isCanonicalNonEmptyString(candidate.id)) {
      return { valid: false, reason: 'invalid_id', index };
    }

    if (ids.has(candidate.id)) {
      return { valid: false, reason: 'duplicate_id', index };
    }

    if (!isCanonicalNonEmptyString(candidate.title)) {
      return { valid: false, reason: 'invalid_title', index };
    }

    if (!SOURCE_COLLECTIONS.has(candidate.sourceCollection as string)) {
      return { valid: false, reason: 'invalid_source_collection', index };
    }

    if (!Array.isArray(candidate.worldIds)) {
      return { valid: false, reason: 'invalid_world_ids', index };
    }

    const worldIds = new Set<string>();
    for (const worldId of candidate.worldIds) {
      if (!isCanonicalNonEmptyString(worldId) || worldIds.has(worldId)) {
        return { valid: false, reason: 'invalid_world_ids', index };
      }
      worldIds.add(worldId);
    }

    if (typeof candidate.editorialStructureVerified !== 'boolean') {
      return { valid: false, reason: 'invalid_entry_shape', index };
    }

    ids.add(candidate.id);
  }

  return { valid: true };
}

export function hasValidSourceCatalog(
  catalog: unknown,
): catalog is readonly SourceCatalogEntry[] {
  return validateSourceCatalog(catalog).valid;
}
