require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createEmptyReadingProgress,
  setCurrentReadingUnit,
  markReadingUnitCompleted,
  sanitizeReadingProgress,
  validateReadingProgress,
  isRequiredForNarrativeCompletion,
  isNarrativeWorkComplete,
  summarizeReadingWork,
  getNextRequiredReadingUnitId,
  getCompletedReadingUnitCount
} = require('../../src/data/roshar/progress.ts');

const unitWorkById = new Map([
  [' ', 'twok'],
  ['twok:chapter:001', 'twok'],
  ['twok:chapter:002', 'twok'],
  ['twok:chapter:003', 'twok'],
  ['wor:chapter:001', 'wor']
]);

test('creates empty progress without inferring any completed units', () => {
  const progress = createEmptyReadingProgress(['twok', 'wor'], '2026-11-04T00:00:00Z');
  assert.deepEqual(progress.map(item => item.completedUnitIds), [[], []]);
});

test('setting the current unit does not complete it or preceding units', () => {
  const initial = createEmptyReadingProgress(['twok'], 't0');
  const next = setCurrentReadingUnit(initial, 'twok', 'twok:chapter:003', unitWorkById, 't1');
  assert.deepEqual(next[0].completedUnitIds, []);
  assert.equal(next[0].currentUnitId, 'twok:chapter:003');
});

test('completing a later unit completes only that explicit unit', () => {
  const initial = createEmptyReadingProgress(['twok'], 't0');
  const next = markReadingUnitCompleted(initial, 'twok', 'twok:chapter:003', unitWorkById, 't1');
  assert.deepEqual(next[0].completedUnitIds, ['twok:chapter:003']);
  assert.equal(next[0].currentUnitId, 'twok:chapter:003');
});

test('rejects cross-work unit assignments and keeps prior state unchanged', () => {
  const initial = createEmptyReadingProgress(['twok'], 't0');
  assert.equal(setCurrentReadingUnit(initial, 'twok', 'wor:chapter:001', unitWorkById, 't1'), initial);
  assert.equal(markReadingUnitCompleted(initial, 'twok', 'missing', unitWorkById, 't1'), initial);
});

test('sanitizes malformed granular progress and never converts legacy chapter counters', () => {
  const empty = sanitizeReadingProgress({ capituloActualPorLibro: { twok: 75 }, librosLeidos: { twok: true } }, ['twok'], unitWorkById, 't0');
  assert.deepEqual(empty, createEmptyReadingProgress(['twok'], 't0'));

  const cleaned = sanitizeReadingProgress([{
    workId: 'twok',
    completedUnitIds: ['twok:chapter:001', 'twok:chapter:001', 'wor:chapter:001', 'unknown'],
    currentUnitId: 'wor:chapter:001',
    updatedAt: 't1'
  }], ['twok'], unitWorkById, 't0');
  assert.deepEqual(cleaned[0].completedUnitIds, ['twok:chapter:001']);
  assert.equal(cleaned[0].currentUnitId, undefined);
});

test('validates work ownership and duplicate progress records', () => {
  const issues = validateReadingProgress([
    { workId: 'twok', completedUnitIds: ['wor:chapter:001'], updatedAt: 't0' },
    { workId: 'twok', completedUnitIds: ['missing', 'missing'], updatedAt: 't0' }
  ], ['twok'], unitWorkById);
  assert.ok(issues.some(issue => issue.code === 'wrong-work'));
  assert.ok(issues.some(issue => issue.code === 'duplicate-unit'));
  assert.ok(issues.some(issue => issue.code === 'duplicate-work'));
});


test('supplementary matter is trackable but does not block narrative completion', () => {
  const unit = kind => ({ id: 'unit', workId: 'twok', ordinal: 1, kind, label: kind });
  for (const kind of ['ars-arcanum', 'afterword', 'acknowledgements', 'appendix']) {
    assert.equal(isRequiredForNarrativeCompletion(unit(kind)), false, kind);
  }
});

test('narrative units and unclassified entries remain required for completion', () => {
  const unit = kind => ({ id: 'unit', workId: 'twok', ordinal: 1, kind, label: kind });
  for (const kind of ['prelude', 'prologue', 'chapter', 'interlude', 'epilogue', 'postlude', 'other']) {
    assert.equal(isRequiredForNarrativeCompletion(unit(kind)), true, kind);
  }
});


test('narrative completion requires every narrative unit but ignores supplementary units', () => {
  const units = [
    { id: 'twok:prologue:001', workId: 'twok', ordinal: 1, kind: 'prologue', label: 'Prologue' },
    { id: 'twok:chapter:001', workId: 'twok', ordinal: 2, kind: 'chapter', label: 'Chapter 1' },
    { id: 'twok:ars-arcanum:001', workId: 'twok', ordinal: 3, kind: 'ars-arcanum', label: 'Ars Arcanum' }
  ];
  assert.equal(isNarrativeWorkComplete('twok', units, [{ workId: 'twok', completedUnitIds: ['twok:prologue:001'], updatedAt: 't0' }]), false);
  assert.equal(isNarrativeWorkComplete('twok', units, [{ workId: 'twok', completedUnitIds: ['twok:prologue:001', 'twok:chapter:001'], updatedAt: 't1' }]), true);
  assert.equal(isNarrativeWorkComplete('missing', units, []), false);
  assert.equal(isNarrativeWorkComplete('empty', [], []), false);
});


test('completed unit count uses explicit granular progress only', () => {
  const progress = [
    { workId: 'twok', completedUnitIds: ['twok:chapter:001', 'twok:chapter:002'], updatedAt: 't0' },
    { workId: 'wor', completedUnitIds: ['wor:chapter:001'], updatedAt: 't0' }
  ];
  assert.equal(getCompletedReadingUnitCount(progress), 3);
  assert.equal(getCompletedReadingUnitCount(progress, 'twok'), 2);
  assert.equal(getCompletedReadingUnitCount(progress, 'missing'), 0);
});


test('summarizeReadingWork counts only explicit required-unit completion', () => {
  const units = [
    { id: 'w:1', workId: 'w', ordinal: 1, kind: 'chapter', label: 'Uno', chapterNumber: 1 },
    { id: 'w:2', workId: 'w', ordinal: 2, kind: 'ars-arcanum', label: 'Ars' },
    { id: 'w:3', workId: 'w', ordinal: 3, kind: 'chapter', label: 'Dos', chapterNumber: 2 }
  ];
  const summary = summarizeReadingWork('w', units, [{
    workId: 'w', completedUnitIds: ['w:1'], updatedAt: 't'
  }]);
  assert.equal(summary.completedUnits, 1);
  assert.equal(summary.requiredUnits, 2);
  assert.equal(summary.completedRequiredUnits, 1);
  assert.equal(summary.percent, 50);
  assert.equal(summary.nextUnitId, 'w:3');
  assert.equal(summary.narrativeComplete, false);
});


test('reading guidance skips unread supplementary matter when choosing the next required unit', () => {
  const units = [
    { id: 'w:1', workId: 'w', ordinal: 1, kind: 'chapter', label: 'Uno' },
    { id: 'w:ars', workId: 'w', ordinal: 2, kind: 'ars-arcanum', label: 'Ars' },
    { id: 'w:2', workId: 'w', ordinal: 3, kind: 'chapter', label: 'Dos' }
  ];
  const progress = [{ workId: 'w', completedUnitIds: ['w:1'], updatedAt: 't' }];
  assert.equal(getNextRequiredReadingUnitId('w', units, progress), 'w:2');
  assert.equal(summarizeReadingWork('w', units, progress).nextUnitId, 'w:2');
});

test('reading guidance is undefined after every required unit is complete', () => {
  const units = [
    { id: 'w:1', workId: 'w', ordinal: 1, kind: 'chapter', label: 'Uno' },
    { id: 'w:ars', workId: 'w', ordinal: 2, kind: 'ars-arcanum', label: 'Ars' }
  ];
  const progress = [{ workId: 'w', completedUnitIds: ['w:1'], updatedAt: 't' }];
  assert.equal(getNextRequiredReadingUnitId('w', units, progress), undefined);
});


test('aggregate completed count ignores every ambiguous duplicate work', () => {
  const progress = [
    { workId: 'twok', completedUnitIds: ['twok:chapter:001', 'twok:chapter:002'], updatedAt: 't0' },
    { workId: 'twok', completedUnitIds: ['twok:chapter:003'], updatedAt: 't1' },
    { workId: 'wor', completedUnitIds: ['wor:chapter:001'], updatedAt: 't0' }
  ];
  assert.equal(getCompletedReadingUnitCount(progress), 1);
  assert.equal(getCompletedReadingUnitCount(progress, 'twok'), 0);
  assert.equal(getCompletedReadingUnitCount(progress, 'wor'), 1);
});


test('mutating ambiguous duplicate progress is fail-closed and does not collapse records', () => {
  const ambiguous = [
    { workId: 'twok', completedUnitIds: ['twok:chapter:001'], updatedAt: 't0' },
    { workId: 'twok', completedUnitIds: ['twok:chapter:002'], updatedAt: 't1' }
  ];
  assert.equal(setCurrentReadingUnit(ambiguous, 'twok', 'twok:chapter:003', unitWorkById, 't2'), ambiguous);
  assert.equal(markReadingUnitCompleted(ambiguous, 'twok', 'twok:chapter:003', unitWorkById, 't2'), ambiguous);
});

test('mutation rejects blank work and reading-unit identifiers', () => {
  const initial = createEmptyReadingProgress(['twok'], 't0');
  assert.equal(setCurrentReadingUnit(initial, ' ', 'twok:chapter:001', unitWorkById, 't1'), initial);
  assert.equal(markReadingUnitCompleted(initial, 'twok', ' ', unitWorkById, 't1'), initial);
});


test('sanitization rejects blank persisted unit identifiers even if a malformed catalog map contains them', () => {
  const cleaned = sanitizeReadingProgress([{
    workId: 'twok',
    completedUnitIds: [' ', 'twok:chapter:001'],
    currentUnitId: ' ',
    updatedAt: 't1'
  }], ['twok'], unitWorkById, 't0');
  assert.deepEqual(cleaned[0].completedUnitIds, ['twok:chapter:001']);
  assert.equal(cleaned[0].currentUnitId, undefined);
});
