import { validateCatalogWorldReferences } from './catalogWorldReferenceValidation';

describe('validateCatalogWorldReferences', () => {
  const worlds = [{ id: 'scadrial', label: 'Scadrial' }];

  it('accepts an empty assignment when no verified relationship is available', () => {
    expect(validateCatalogWorldReferences(
      [{ id: 'work', title: 'Work', sourceCollection: 'cosmere.epub', worldIds: [], editorialStructureVerified: false }],
      worlds,
    )).toEqual({ valid: true });
  });

  it('accepts references to registered worlds', () => {
    expect(validateCatalogWorldReferences(
      [{ id: 'work', title: 'Work', sourceCollection: 'cosmere.epub', worldIds: ['scadrial'], editorialStructureVerified: false }],
      worlds,
    )).toEqual({ valid: true });
  });

  it('blocks unknown world references', () => {
    expect(validateCatalogWorldReferences(
      [{ id: 'work', title: 'Work', sourceCollection: 'cosmere.epub', worldIds: ['unknown'], editorialStructureVerified: false }],
      worlds,
    )).toEqual({ valid: false, reason: 'unknown_world_reference', catalogIndex: 0 });
  });

  it('blocks malformed registries', () => {
    expect(validateCatalogWorldReferences([], [{ id: 'scadrial', label: 'Scadrial' }, { id: 'scadrial', label: 'Duplicate' }]))
      .toEqual({ valid: false, reason: 'invalid_world_registry', worldIndex: 1 });
  });
});
