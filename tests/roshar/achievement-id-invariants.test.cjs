require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateRosharReadingAchievements, selectVisibleRosharAchievements } = require('../../src/data/roshar/achievements.ts');

test('achievement identifiers are normalized and duplicate IDs fail closed', () => {
  const units = [{ id: 'w:1', workId: 'w', ordinal: 1, kind: 'chapter', label: '1', chapterNumber: 1 }];
  const achievements = [
    { id: ' same ', requiredCompletedUnits: 0, title: 'First', description: '' },
    { id: 'same', requiredCompletedUnits: 999, title: 'Conflicting duplicate', description: '' }
  ];
  const evaluated = evaluateRosharReadingAchievements(achievements, units, []);
  assert.equal(evaluated.length, 1);
  const visible = selectVisibleRosharAchievements(evaluated, [], ['same']);
  assert.deepEqual(visible.map(item => item.id), ['same']);
  assert.equal(visible[0].unlocked, true);
});

test('presentation deduplicates conflicting runtime projections by normalized ID', () => {
  const visible = selectVisibleRosharAchievements([
    { achievement: { id: ' dup ', title: 'Safe', description: '' }, unlocked: false },
    { achievement: { id: 'dup', title: 'Conflicting', description: '' }, unlocked: true }
  ], [], []);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'dup');
  assert.equal(visible[0].unlocked, false);
});
