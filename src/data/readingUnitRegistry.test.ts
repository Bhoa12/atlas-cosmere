import {
  listReadingUnitsForWork,
  validateReadingUnitRegistry,
} from './readingUnitRegistry';

describe('readingUnitRegistry', () => {
  const registry = [
    { id: 'work-a-unit-2', workId: 'work-a', label: 'Unidad 2', position: 2 },
    { id: 'work-a-unit-1', workId: 'work-a', label: 'Unidad 1', position: 1 },
    { id: 'work-b-unit-1', workId: 'work-b', label: 'Unidad 1', position: 1 },
  ];

  it('accepts generic units without interpreting editorial structure', () => {
    expect(validateReadingUnitRegistry(registry)).toEqual({
      status: 'valid',
      units: registry,
    });
  });

  it('lists units for a work in technical position order', () => {
    expect(listReadingUnitsForWork(registry, 'work-a').map((unit) => unit.id)).toEqual([
      'work-a-unit-1',
      'work-a-unit-2',
    ]);
  });

  it('fails closed for duplicate ids or positions within a work', () => {
    expect(validateReadingUnitRegistry([
      registry[0],
      { id: 'work-a-unit-2', workId: 'work-b', label: 'Otra', position: 1 },
    ])).toEqual({ status: 'blocked', reason: 'invalid_registry' });

    expect(validateReadingUnitRegistry([
      registry[0],
      { id: 'other-unit', workId: 'work-a', label: 'Otra', position: 2 },
    ])).toEqual({ status: 'blocked', reason: 'invalid_registry' });
  });

  it('returns no units for malformed input or non-canonical work ids', () => {
    expect(listReadingUnitsForWork(null, 'work-a')).toEqual([]);
    expect(listReadingUnitsForWork(registry, ' work-a')).toEqual([]);
  });
});
