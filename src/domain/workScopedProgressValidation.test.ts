import { describe, expect, it } from 'vitest';
import { validateWorkScopedProgress } from './workScopedProgressValidation';
import type { ReadingProgress, ReadingUnit } from './readingProgress';

const units: ReadingUnit[] = [
  { id: 'a-1', workId: 'work-a', position: 1 },
  { id: 'a-2', workId: 'work-a', position: 2 },
  { id: 'b-1', workId: 'work-b', position: 1 },
];

describe('validateWorkScopedProgress', () => {
  it('accepts progress scoped to declared units of the same work', () => {
    const progress: ReadingProgress[] = [
      { workId: 'work-a', completedUnitIds: ['a-1', 'a-2'] },
      { workId: 'work-b', completedUnitIds: ['b-1'] },
    ];

    expect(validateWorkScopedProgress(units, progress)).toEqual([]);
  });

  it('reports progress for an unknown work', () => {
    const progress: ReadingProgress[] = [
      { workId: 'missing-work', completedUnitIds: ['anything'] },
    ];

    expect(validateWorkScopedProgress(units, progress)).toEqual([
      { code: 'unknown_work', workId: 'missing-work' },
    ]);
  });

  it('reports units that do not belong to the progress work', () => {
    const progress: ReadingProgress[] = [
      { workId: 'work-a', completedUnitIds: ['b-1', 'missing-unit'] },
    ];

    expect(validateWorkScopedProgress(units, progress)).toEqual([
      { code: 'foreign_unit', workId: 'work-a', unitId: 'b-1' },
      { code: 'foreign_unit', workId: 'work-a', unitId: 'missing-unit' },
    ]);
  });

  it('does not duplicate diagnostics for repeated persisted IDs', () => {
    const progress: ReadingProgress[] = [
      { workId: 'work-a', completedUnitIds: ['missing-unit', 'missing-unit'] },
    ];

    expect(validateWorkScopedProgress(units, progress)).toEqual([
      { code: 'foreign_unit', workId: 'work-a', unitId: 'missing-unit' },
    ]);
  });
});
