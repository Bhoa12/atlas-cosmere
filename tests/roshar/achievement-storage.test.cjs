require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadRosharAchievementState,
  saveRosharAchievementState,
  ROSHAR_ACHIEVEMENT_STORAGE_KEY
} = require('../../src/data/roshar/achievementStorage.ts');

function storage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    async getItem(key) { return data.has(key) ? data.get(key) : null; },
    async setItem(key, value) { data.set(key, value); }
  };
}

test('achievement storage round-trips through a versioned key', async () => {
  const s = storage();
  const state = { unlockedAchievementIds: ['a'], unlockedRewardIds: ['r'], updatedAt: 'old' };
  assert.equal(await saveRosharAchievementState(s, state, 'now'), true);
  const loaded = await loadRosharAchievementState(s, 'later');
  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.state.unlockedAchievementIds, ['a']);
  assert.deepEqual(loaded.state.unlockedRewardIds, ['r']);
  assert.ok(s.data.has(ROSHAR_ACHIEVEMENT_STORAGE_KEY));
});

test('corrupt or incompatible achievement payloads never throw', async () => {
  const corrupt = storage({ [ROSHAR_ACHIEVEMENT_STORAGE_KEY]: '{bad' });
  const bad = await loadRosharAchievementState(corrupt, 'now');
  assert.equal(bad.status, 'invalid');
  assert.deepEqual(bad.state.unlockedAchievementIds, []);

  const incompatible = storage({ [ROSHAR_ACHIEVEMENT_STORAGE_KEY]: JSON.stringify({ version: 2, state: {} }) });
  const next = await loadRosharAchievementState(incompatible, 'now');
  assert.equal(next.status, 'invalid');
});

test('storage unavailability is reported without losing a safe fallback', async () => {
  const broken = { async getItem() { throw new Error('offline'); }, async setItem() { throw new Error('offline'); } };
  const loaded = await loadRosharAchievementState(broken, 'now');
  assert.equal(loaded.status, 'unavailable');
  assert.deepEqual(loaded.state.unlockedRewardIds, []);
  assert.equal(await saveRosharAchievementState(broken, loaded.state, 'now'), false);
});
