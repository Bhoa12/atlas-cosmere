require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateRosharReadingAchievements,
  selectUnlockedRosharRewardIds
} = require('../../src/data/roshar/achievements.ts');

const units = [
  { id: 'w:p', workId: 'w', ordinal: 1, kind: 'prologue', label: 'P' },
  { id: 'w:1', workId: 'w', ordinal: 2, kind: 'chapter', label: '1', chapterNumber: 1 },
  { id: 'w:ars', workId: 'w', ordinal: 3, kind: 'ars-arcanum', label: 'Ars' }
];

test('reading achievements unlock only from explicit progress', () => {
  const achievements = [
    { id: 'first', requiredCompletedUnits: 1, title: 'First', description: '', reward: { type: 'nickname', id: 'r1', label: 'R1' } },
    { id: 'complete', workId: 'w', requiresNarrativeCompletion: true, title: 'Complete', description: '', reward: { type: 'profile-frame', id: 'r2', label: 'R2' } }
  ];
  const progress = [{ workId: 'w', completedUnitIds: ['w:1'], updatedAt: 't' }];
  const result = evaluateRosharReadingAchievements(achievements, units, progress);
  assert.equal(result[0].unlocked, true);
  assert.equal(result[1].unlocked, false);
});

test('narrative completion unlocks without requiring supplementary matter', () => {
  const achievement = { id: 'complete', workId: 'w', requiresNarrativeCompletion: true, title: 'Complete', description: '', reward: { type: 'profile-frame', id: 'r2', label: 'R2' } };
  const progress = [{ workId: 'w', completedUnitIds: ['w:p', 'w:1'], updatedAt: 't' }];
  const result = evaluateRosharReadingAchievements([achievement], units, progress);
  assert.equal(result[0].unlocked, true);
});

test('reward projection is idempotent and deduplicated', () => {
  const reward = { type: 'nickname', id: 'same', label: 'Same' };
  const projections = [
    { achievement: { id: 'a', title: 'A', description: '', reward }, unlocked: true },
    { achievement: { id: 'b', title: 'B', description: '', reward }, unlocked: true }
  ];
  assert.deepEqual(selectUnlockedRosharRewardIds(projections), ['same']);
});
