import { describe, expect, it } from 'vitest';
import { ReadingUnit } from './readingProgress';
import { hasValidReadingUnits, validateReadingUnits } from './readingUnitValidation';

describe('reading unit validation', () => {
  const valid: ReadingUnit[] = [
    { id: 'a-1', workId: 'work-a', position: 1 },
    { id: 'a-2', workId: 'work-a', position: 2 },
    { id: 'b-1', workId: 'work-b', position: 1 },
  ];

  it('accepts independent ordered units across works', () => {
    expect(validateReadingUnits(valid)).toEqual([]);
    expect(hasValidReadingUnits(valid)).toBe(true);
  });

  it('rejects duplicate unit identifiers', () => {
    expect(validateReadingUnits([...valid, { id: 'a-1', workId: 'work-b', position: 2 }]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate_id', unitId: 'a-1' })]));
  });

  it('rejects empty work identifiers and invalid positions', () => {
    const issues = validateReadingUnits([
      { id: 'x', workId: '', position: 1 },
      { id: 'y', workId: 'work-a', position: 0 },
    ]);
    expect(issues.map((issue) => issue.code)).toEqual(['empty_work_id', 'invalid_position']);
  });

  it('rejects duplicate positions within the same work but not across works', () => {
    const issues = validateReadingUnits([
      { id: 'a', workId: 'work-a', position: 1 },
      { id: 'b', workId: 'work-a', position: 1 },
      { id: 'c', workId: 'work-b', position: 1 },
    ]);
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate_position', workId: 'work-a' })]));
    expect(issues.filter((issue) => issue.code === 'duplicate_position')).toHaveLength(1);
  });
  it('fails closed for malformed runtime metadata instead of throwing', () => {
    const malformed = [null, { id: 7, workId: 'work-a', position: 1 }] as unknown as ReadingUnit[];
    expect(validateReadingUnits(malformed).map((issue) => issue.code))
      .toEqual(['invalid_unit_shape', 'invalid_unit_shape']);
    expect(hasValidReadingUnits(malformed)).toBe(false);
  });
});
