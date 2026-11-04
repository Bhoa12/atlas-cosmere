require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectVisibleRosharAchievements } = require('../../src/data/roshar/achievements.ts');

test('hidden spoiler-gated achievement does not reveal its title before its gate', () => {
  const achievement = {
    id: 'secret',
    requiredCompletedUnits: 10,
    title: 'Spoiler title',
    description: 'Spoiler description',
    hiddenUntilUnlocked: true,
    spoilerGate: { allOf: [{ workId: 'twok', readingUnitId: 'twok:chapter:010' }] },
    reward: { type: 'nickname', id: 'reward', label: 'Reward' }
  };
  const result = selectVisibleRosharAchievements(
    [{ achievement, unlocked: false }],
    [{ workId: 'twok', completedUnitIds: [], updatedAt: 't' }]
  );
  assert.deepEqual(result[0], {
    id: 'secret', title: '???', description: 'Logro aún oculto.', hidden: true, unlocked: false
  });
});

test('achievement title becomes available when its spoiler gate is reached', () => {
  const achievement = {
    id: 'known',
    title: 'Known title',
    description: 'Known description',
    spoilerGate: { allOf: [{ workId: 'twok', readingUnitId: 'twok:chapter:010' }] },
    reward: { type: 'nickname', id: 'reward', label: 'Reward' }
  };
  const result = selectVisibleRosharAchievements(
    [{ achievement, unlocked: false }],
    [{ workId: 'twok', completedUnitIds: ['twok:chapter:010'], updatedAt: 't' }]
  );
  assert.equal(result[0].title, 'Known title');
  assert.equal(result[0].hidden, false);
});
