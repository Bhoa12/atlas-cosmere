import { validateSourceCatalog } from './sourceCatalogValidation';

const validEntry = {
  id: 'sample-work',
  title: 'Sample Work',
  sourceCollection: 'cosmere.epub',
  worldIds: [],
  editorialStructureVerified: false,
};

describe('validateSourceCatalog', () => {
  it('accepts metadata-only entries without editorial assertions', () => {
    expect(validateSourceCatalog([validEntry])).toEqual({ valid: true });
  });

  it('rejects a non-array catalog', () => {
    expect(validateSourceCatalog({ entries: [] })).toEqual({
      valid: false,
      reason: 'invalid_collection_shape',
    });
  });

  it('rejects duplicate work identifiers', () => {
    expect(validateSourceCatalog([validEntry, { ...validEntry }])).toEqual({
      valid: false,
      reason: 'duplicate_id',
      index: 1,
    });
  });

  it('rejects malformed world-id metadata without inferring a world', () => {
    expect(validateSourceCatalog([{ ...validEntry, worldIds: [' scadrial'] }])).toEqual({
      valid: false,
      reason: 'invalid_world_ids',
      index: 0,
    });
  });

  it('rejects an unknown source collection', () => {
    expect(validateSourceCatalog([{ ...validEntry, sourceCollection: 'other.epub' }])).toEqual({
      valid: false,
      reason: 'invalid_source_collection',
      index: 0,
    });
  });
});
