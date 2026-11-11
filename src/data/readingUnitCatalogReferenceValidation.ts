import { resolveCatalogWork } from './cosmereExpansionCatalog';
import {
  type ReadingUnit,
  validateReadingUnitRegistry,
} from './readingUnitRegistry';

/**
 * Validates that technical reading units point only to works already present in
 * the verified source catalog.
 *
 * This boundary validates identifiers only. A successful reference does not
 * establish chapters, pages, chronology, world membership, or narrative facts.
 */
export type ReadingUnitCatalogReferenceResult =
  | { status: 'valid'; units: readonly ReadingUnit[] }
  | { status: 'blocked'; reason: 'invalid_registry' | 'unknown_work_reference' };

export function validateReadingUnitCatalogReferences(
  registry: unknown,
): ReadingUnitCatalogReferenceResult {
  const registryResult = validateReadingUnitRegistry(registry);
  if (registryResult.status !== 'valid') {
    return { status: 'blocked', reason: 'invalid_registry' };
  }

  for (const unit of registryResult.units) {
    if (!resolveCatalogWork(unit.workId)) {
      return { status: 'blocked', reason: 'unknown_work_reference' };
    }
  }

  return { status: 'valid', units: registryResult.units };
}
