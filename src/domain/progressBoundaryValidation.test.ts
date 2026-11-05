import { describe, expect, it } from 'vitest';
import type { WorkCatalogEntry } from './cosmereCatalog';
import { validateProgressBoundaries } from './progressBoundaryValidation';

const work: WorkCatalogEntry = {
  id: 'work-a',
  worldId: 'world-a',
  title: 'Metadata only',
  sequence: 1,
  format: 'novel',
  units: [
    { id: 'a-0', workId: 'work-a', order: 0, kind: 'chapter', label: '1' },
    { id: 'a-2', workId: 'work-a', order: 2, kind: 'chapter', label: '2' },
  ],
};

describe('validateProgressBoundaries', () => {
  it('accepts progress inside declared coordinates', () => {
    expect(validateProgressBoundaries([work], [
      { workId: 'work-a', completedUnitOrder: 2 },
    ])).toEqual([]);
  });

  it('rejects unknown works without guessing a replacement', () => {
    expect(validateProgressBoundaries([work], [
      { workId: 'missing', completedUnitOrder: 1 },
    ])).toEqual([{ code: 'unknown_work', workId: 'missing' }]);
  });

  it('rejects invalid or out-of-range progress', () => {
    expect(validateProgressBoundaries([work], [
      { workId: 'work-a', completedUnitOrder: -1 },
      { workId: 'work-a', completedUnitOrder: 3 },
    ])).toEqual([
      { code: 'negative_progress', workId: 'work-a', completedUnitOrder: -1 },
      {
        code: 'progress_beyond_declared_structure',
        workId: 'work-a',
        completedUnitOrder: 3,
        maximumUnitOrder: 2,
      },
    ]);
  });
});
