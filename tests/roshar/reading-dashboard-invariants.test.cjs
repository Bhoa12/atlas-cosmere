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

test('a current position in optional material does not advance the narrative frontier', () => {
  const progress = [{
    workId: 'w',
    completedUnitIds: ['w:p', 'w:1', 'w:ars'],
    currentUnitId: 'w:ars',
    updatedAt: 't'
  }];
  const streak = summarizeNarrativeReadingStreak('w', units, progress);
  const dashboard = buildRosharReadingDashboard('w', units, progress);
  assert.equal(streak.completedConsecutiveUnits, 2);
  assert.equal(streak.firstGapUnitId, 'w:2');
  assert.equal(streak.currentUnitIsCompleted, true);
  assert.equal(dashboard.percent, 67);
  assert.equal(dashboard.nextNarrativeUnitId, 'w:2');
});

test('an unknown current unit cannot be treated as a completed narrative position', () => {
  const progress = [{
    workId: 'w',
    completedUnitIds: ['w:p'],
    currentUnitId: 'w:unknown',
    updatedAt: 't'
  }];
  const streak = summarizeNarrativeReadingStreak('w', units, progress);
  assert.equal(streak.currentUnitIsCompleted, false);
  assert.equal(streak.firstGapUnitId, 'w:1');
  assert.equal(streak.completedConsecutiveUnits, 1);
});