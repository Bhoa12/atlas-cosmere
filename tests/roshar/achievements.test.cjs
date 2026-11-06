require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateRosharReadingAchievements,
  selectUnlockedRosharRewardIds,
  selectVisibleRosharAchievements
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


test('persisted achievement grants remain visible after a later progress correction', () => {
  const achievement = {
    id: 'monotonic',
    requiredCompletedUnits: 2,
    title: 'Granted once',
    description: 'Persists after correction.',
    reward: { type: 'badge', id: 'badge-1', label: 'Badge' }
  };
  const projections = evaluateRosharReadingAchievements([achievement], units, []);
  const visible = selectVisibleRosharAchievements(projections, [], ['monotonic']);
  assert.equal(visible[0].unlocked, true);
  assert.equal(visible[0].title, 'Granted once');
  assert.equal(visible[0].reward.id, 'badge-1');
});


test('ambiguous duplicate progress cannot reveal spoiler-gated achievement metadata', () => {
  const achievement = {
    id: 'gated',
    requiredCompletedUnits: 99,
    title: 'Spoiler title',
    description: 'Spoiler description',
    spoilerGate: { requiredUnitIds: ['twok:chapter:001'] },
    reward: { type: 'badge', id: 'badge-gated', label: 'Gated' }
  };
  const projections = evaluateRosharReadingAchievements([achievement], units, [
    { workId: 'twok', completedUnitIds: ['twok:chapter:001'], updatedAt: 't0' },
    { workId: 'twok', completedUnitIds: [], updatedAt: 't1' }
  ]);
  const visible = selectVisibleRosharAchievements(projections, [
    { workId: 'twok', completedUnitIds: ['twok:chapter:001'], updatedAt: 't0' },
    { workId: 'twok', completedUnitIds: [], updatedAt: 't1' }
  ]);
  assert.equal(visible[0].hidden, true);
  assert.equal(visible[0].title, '???');
});
