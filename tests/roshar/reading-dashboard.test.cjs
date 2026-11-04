require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  summarizeNarrativeReadingStreak,
  buildRosharReadingDashboard
} = require('../../src/data/roshar/readingDashboard.ts');

const units = [
  { id: 'w:p', workId: 'w', ordinal: 1, kind: 'prologue', label: 'P' },
  { id: 'w:1', workId: 'w', ordinal: 2, kind: 'chapter', label: '1', chapterNumber: 1 },
  { id: 'w:ars', workId: 'w', ordinal: 3, kind: 'ars-arcanum', label: 'Ars' },
  { id: 'w:2', workId: 'w', ordinal: 4, kind: 'chapter', label: '2', chapterNumber: 2 }
];

test('reading streak preserves gaps instead of inferring earlier completion', () => {
  const progress = [{ workId: 'w', completedUnitIds: ['w:1', 'w:2'], currentUnitId: 'w:2', updatedAt: 't' }];
  const streak = summarizeNarrativeReadingStreak('w', units, progress);
  assert.equal(streak.completedConsecutiveUnits, 0);
  assert.equal(streak.firstGapUnitId, 'w:p');
  assert.equal(streak.currentUnitIsCompleted, true);
});

test('dashboard reports the first narrative gap and does not count supplementary matter', () => {
  const progress = [{ workId: 'w', completedUnitIds: ['w:p', 'w:1'], updatedAt: 't' }];
  const dashboard = buildRosharReadingDashboard('w', units, progress);
  assert.equal(dashboard.percent, 67);
  assert.equal(dashboard.completedConsecutiveUnits, 2);
  assert.equal(dashboard.firstGapUnitId, 'w:2');
  assert.equal(dashboard.nextNarrativeUnitId, 'w:2');
  assert.equal(dashboard.narrativeComplete, false);
});
