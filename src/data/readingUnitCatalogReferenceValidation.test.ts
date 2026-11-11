import { validateReadingUnitCatalogReferences } from './readingUnitCatalogReferenceValidation';

describe('readingUnitCatalogReferenceValidation', () => {
  it('accepts generic units that reference known catalog works', () => {
    const registry = [
      {
        id: 'mistborn-final-empire-unit-1',
        workId: 'mistborn-final-empire',
        label: 'Unidad 1',
        position: 1,
      },
    ];

    expect(validateReadingUnitCatalogReferences(registry)).toEqual({
      status: 'valid',
      units: registry,
    });
  });

  it('blocks units that reference unknown works', () => {
    expect(validateReadingUnitCatalogReferences([
      {
        id: 'unknown-work-unit-1',
        workId: 'unknown-work',
        label: 'Unidad 1',
        position: 1,
      },
    ])).toEqual({
      status: 'blocked',
      reason: 'unknown_work_reference',
    });
  });

  it('preserves the reading-unit fail-closed boundary for malformed registries', () => {
    expect(validateReadingUnitCatalogReferences([
      {
        id: 'bad-unit',
        workId: 'mistborn-final-empire',
        label: 'Unidad 1',
        position: 0,
      },
    ])).toEqual({
      status: 'blocked',
      reason: 'invalid_registry',
    });

    expect(validateReadingUnitCatalogReferences(null)).toEqual({
      status: 'blocked',
      reason: 'invalid_registry',
    });
  });
});
