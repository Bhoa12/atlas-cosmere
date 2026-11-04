import { describe, expect, it } from 'vitest';
import { getCompletedCount, getProgressFraction, isUnitCompleted, ReadingUnit } from './readingProgress';
import { evaluateSpoilerAccess } from './spoilerAccess';

const units: ReadingUnit[] = [
  { id: 'unit-1', workId: 'work-a', position: 1 },
  { id: 'unit-2', workId: 'work-a', position: 2 },
];

describe('reading progress domain', () => {
  it('counts only completed identifiers belonging to the supplied work units', () => {
    expect(getProgressFraction(units, { workId: 'work-a', completedUnitIds: ['unit-1', 'unknown'] })).toBe(0.5);
  });

  it('deduplicates repeated completed identifiers', () => {
    expect(getProgressFraction(units, { workId: 'work-a', completedUnitIds: ['unit-1', 'unit-1'] })).toBe(0.5);
  });

  it('handles empty unit collections safely', () => {
    expect(getProgressFraction([], { workId: 'work-a', completedUnitIds: ['unit-1'] })).toBe(0);
  });

  it('handles missing progress safely', () => {
    expect(getProgressFraction(units, undefined)).toBe(0);
    expect(getCompletedCount(undefined)).toBe(0);
  });

  it('checks explicit unit completion', () => {
    expect(isUnitCompleted({ workId: 'work-a', completedUnitIds: ['unit-2'] }, 'unit-2')).toBe(true);
  });
});

describe('spoiler access', () => {
  it('blocks content until every explicit requirement is met', () => {
    expect(evaluateSpoilerAccess(
      [{ workId: 'work-a', completedUnitId: 'unit-2' }, { workId: 'work-b', completedUnitId: 'unit-x' }],
      {
        'work-a': { workId: 'work-a', completedUnitIds: ['unit-1', 'unit-2'] },
        'work-b': { workId: 'work-b', completedUnitIds: [] },
      },
    )).toBe('blocked');
  });

  it('blocks requirements when no progress exists for the required work', () => {
    expect(evaluateSpoilerAccess([{ workId: 'work-a', completedUnitId: 'unit-1' }], {})).toBe('blocked');
  });

  it('does not infer requirements from absent metadata', () => {
    expect(evaluateSpoilerAccess([], {})).toBe('visible');
  });
});
