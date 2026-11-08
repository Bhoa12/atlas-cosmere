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


test('malformed or cross-work unit IDs cannot inflate count-based achievements', () => {
  const achievement = { id: 'two', requiredCompletedUnits: 2, title: 'Two', description: '', reward: { type: 'badge', id: 'r', label: 'R' } };
  const progress = [{
    workId: 'w',
    completedUnitIds: ['w:1', 'w:1', 'missing', 'other:1'],
    updatedAt: 't'
  }];
  const result = evaluateRosharReadingAchievements([achievement], units, progress);
  assert.equal(result[0].unlocked, false);
});

test('ambiguous duplicate work records cannot contribute to count-based achievements', () => {
  const achievement = { id: 'one', requiredCompletedUnits: 1, title: 'One', description: '', reward: { type: 'badge', id: 'r', label: 'R' } };
  const progress = [
    { workId: 'w', completedUnitIds: ['w:1'], updatedAt: 't0' },
    { workId: 'w', completedUnitIds: ['w:p'], updatedAt: 't1' }
  ];
  const result = evaluateRosharReadingAchievements([achievement], units, progress);
  assert.equal(result[0].unlocked, false);
});


test('achievement selectors fail closed for malformed runtime collections', () => {
  assert.deepEqual(evaluateRosharReadingAchievements(null, null, null), []);
  assert.deepEqual(selectVisibleRosharAchievements(null, null, null), []);
  assert.deepEqual(selectUnlockedRosharRewardIds([
    null,
    { unlocked: true, achievement: { reward: { id: ' valid ' } } },
    { unlocked: true, achievement: { id: 'valid', title: 'Valid', description: '', reward: { id: ' valid ' } } },
    { unlocked: true, achievement: { id: 'blank-reward', title: 'Blank', description: '', reward: { id: ' ' } } }
  ]), ['valid']);
});


test('invalid achievement identifiers and non-boolean projection state fail closed', () => {
  const evaluated = evaluateRosharReadingAchievements([
    { id: ' ', requiredCompletedUnits: 0, title: 'Leak', description: '' },
    { id: 'valid', requiredCompletedUnits: 0, title: 'Valid', description: '' }
  ], units, []);
  assert.equal(evaluated.length, 1);
  assert.equal(evaluated[0].achievement.id, 'valid');

  const visible = selectVisibleRosharAchievements([
    { achievement: { id: ' ', title: 'Leak', description: '' }, unlocked: true },
    { achievement: { id: 'truthy', title: 'Leak', description: '' }, unlocked: 'yes' },
    { achievement: { id: 'valid', title: 'Valid', description: '' }, unlocked: false }
  ], [], []);
  assert.deepEqual(visible.map(item => item.id), ['valid']);
});


test('malformed achievement requirements cannot unlock rewards', () => {
  const result = evaluateRosharReadingAchievements([
    { id: 'negative', requiredCompletedUnits: -1, title: 'Leak', description: '' },
    { id: 'fraction', requiredCompletedUnits: 0.5, title: 'Leak', description: '' },
    { id: 'infinite', requiredCompletedUnits: Infinity, title: 'Leak', description: '' },
    { id: 'truthy-completion', requiresNarrativeCompletion: 'yes', title: 'Leak', description: '' },
    { id: 'blank-work', workId: '   ', requiresNarrativeCompletion: true, title: 'Leak', description: '' },
    { id: 'valid-zero', requiredCompletedUnits: 0, title: 'Valid', description: '' }
  ], units, []);
  assert.deepEqual(result.map(item => item.achievement.id), ['valid-zero']);
  assert.equal(result[0].unlocked, true);
});


test('reward selector requires a strictly unlocked, valid achievement projection', () => {
  const reward = { id: 'safe', type: 'badge', label: 'Safe' };
  const rewards = selectUnlockedRosharRewardIds([
    { unlocked: 'yes', achievement: { id: 'truthy', title: 'Leak', description: '', reward } },
    { unlocked: true, achievement: { id: ' ', title: 'Leak', description: '', reward } },
    { unlocked: true, achievement: { id: 'safe-achievement', title: 'Safe', description: '', reward } }
  ]);
  assert.deepEqual(rewards, ['safe']);
});
