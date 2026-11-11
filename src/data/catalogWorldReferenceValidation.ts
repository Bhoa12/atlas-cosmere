import type { SourceCatalogEntry } from './cosmereExpansionCatalog';
import type { CosmereWorld } from './cosmereWorldRegistry';

export type CatalogWorldReferenceReason =
  | 'invalid_catalog'
  | 'invalid_world_registry'
  | 'unknown_world_reference';

export type CatalogWorldReferenceValidationResult =
  | { valid: true }
  | { valid: false; reason: CatalogWorldReferenceReason; catalogIndex?: number; worldIndex?: number };

/**
 * Validates that catalog metadata never points at an unknown world.
 *
 * It does not assign works to worlds or infer missing relationships. Empty
 * worldIds remain valid when no verified assignment is available.
 */
export function validateCatalogWorldReferences(
  catalog: unknown,
  worldRegistry: unknown,
): CatalogWorldReferenceValidationResult {
  if (!Array.isArray(catalog)) return { valid: false, reason: 'invalid_catalog' };
  if (!Array.isArray(worldRegistry)) return { valid: false, reason: 'invalid_world_registry' };

  const knownWorldIds = new Set<string>();
  for (let worldIndex = 0; worldIndex < worldRegistry.length; worldIndex += 1) {
    const world = worldRegistry[worldIndex];
    if (!world || typeof world !== 'object' || Array.isArray(world)) {
      return { valid: false, reason: 'invalid_world_registry', worldIndex };
    }
    const id = (world as Partial<CosmereWorld>).id;
    if (typeof id !== 'string' || id.length === 0 || id.trim() !== id || knownWorldIds.has(id)) {
      return { valid: false, reason: 'invalid_world_registry', worldIndex };
    }
    knownWorldIds.add(id);
  }

  for (let catalogIndex = 0; catalogIndex < catalog.length; catalogIndex += 1) {
    const entry = catalog[catalogIndex];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { valid: false, reason: 'invalid_catalog', catalogIndex };
    }
    const worldIds = (entry as Partial<SourceCatalogEntry>).worldIds;
    if (!Array.isArray(worldIds)) return { valid: false, reason: 'invalid_catalog', catalogIndex };

    for (const worldId of worldIds) {
      if (typeof worldId !== 'string' || !knownWorldIds.has(worldId)) {
        return { valid: false, reason: 'unknown_world_reference', catalogIndex };
      }
    }
  }

  return { valid: true };
}
