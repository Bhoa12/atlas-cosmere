require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createEmptyRosharAchievementState,
  applyRosharAchievementProjections,
  sanitizeRosharAchievementState
} = require('../../src/data/roshar/achievementState.ts');

const reward = { type: 'nickname', id: 'reward', label: 'Reward' };

test('achievement state grants unlocked items once and never revokes them', () => {
  const initial = createEmptyRosharAchievementState('t0');
  const granted = applyRosharAchievementProjections(initial, [
    { achievement: { id: 'a', title: 'A', description: '', reward }, unlocked: true }
  ], 't1');
  const later = applyRosharAchievementProjections(granted, [
    { achievement: { id: 'a', title: 'A', description: '', reward }, unlocked: false }
  ], 't2');

  assert.deepEqual(later.unlockedAchievementIds, ['a']);
  assert.deepEqual(later.unlockedRewardIds, ['reward']);
  assert.equal(later.updatedAt, 't2');
});

test('achievement state deduplicates rewards shared by multiple achievements', () => {
  const state = applyRosharAchievementProjections(undefined, [
    { achievement: { id: 'a', title: 'A', description: '', reward }, unlocked: true },
    { achievement: { id: 'b', title: 'B', description: '', reward }, unlocked: true }
  ], 't');
  assert.deepEqual(state.unlockedAchievementIds, ['a', 'b']);
  assert.deepEqual(state.unlockedRewardIds, ['reward']);
});

test('achievement state sanitizer rejects malformed persisted values', () => {
  assert.deepEqual(
    sanitizeRosharAchievementState(
      { unlockedAchievementIds: ['a', 'a', 3], unlockedRewardIds: ['r', '', null] },
      'fallback'
    ),
    { unlockedAchievementIds: ['a'], unlockedRewardIds: ['r'], updatedAt: 'fallback' }
  );
});
