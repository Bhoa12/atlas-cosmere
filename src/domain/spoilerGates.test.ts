import { describe, expect, it } from 'vitest';
import { filterUnlockedGateIds, isSpoilerGateUnlocked } from './spoilerGates';

describe('spoiler gates', () => {
  it('unlocks only when the matching work reaches the explicit position', () => {
    expect(isSpoilerGateUnlocked(
      { id: 'gate-a', workId: 'work-a', requiredPosition: 2 },
      [{ workId: 'work-a', completedPositions: [1, 2] }],
    )).toBe(true);
  });

  it('does not unlock from progress in another work', () => {
    expect(isSpoilerGateUnlocked(
      { id: 'gate-a', workId: 'work-a', requiredPosition: 1 },
      [{ workId: 'work-b', completedPositions: [1, 2] }],
    )).toBe(false);
  });

  it('fails closed for invalid gates', () => {
    expect(isSpoilerGateUnlocked(
      { id: '', workId: 'work-a', requiredPosition: 0 },
      [{ workId: 'work-a', completedPositions: [0] }],
    )).toBe(false);
  });

  it('returns only explicitly unlocked gate identifiers', () => {
    expect(filterUnlockedGateIds([
      { id: 'a', workId: 'work-a', requiredPosition: 1 },
      { id: 'b', workId: 'work-b', requiredPosition: 1 },
    ], [{ workId: 'work-a', completedPositions: [1] }])).toEqual(['a']);
  });
});
