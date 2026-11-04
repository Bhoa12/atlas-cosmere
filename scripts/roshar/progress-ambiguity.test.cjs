require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getUnambiguousReadingProgress,
  summarizeReadingWork,
  getNextRequiredReadingUnitId
} = require('../../src/data/roshar/progress.ts');

const units = [
  { id: 'w:1', workId: 'w', ordinal: 1, kind: 'chapter', label: '1', chapterNumber: 1 },
  { id: 'w:2', workId: 'w', ordinal: 2, kind: 'chapter', label: '2', chapterNumber: 2 }
];

test('duplicate progress records fail closed instead of granting ambiguous completion', () => {
  const progress = [
    { workId: 'w', completedUnitIds: ['w:1'], updatedAt: 'old' },
    { workId: 'w', completedUnitIds: ['w:1', 'w:2'], updatedAt: 'new' }
  ];
  assert.equal(getUnambiguousReadingProgress(progress, 'w'), undefined);
  const summary = summarizeReadingWork('w', units, progress);
  assert.equal(summary.completedRequiredUnits, 0);
  assert.equal(summary.percent, 0);
  assert.equal(summary.narrativeComplete, false);
  assert.equal(getNextRequiredReadingUnitId('w', units, progress), 'w:1');
});
