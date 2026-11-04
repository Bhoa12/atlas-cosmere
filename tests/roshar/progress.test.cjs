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
  isNarrativeWorkComplete
} = require('../../src/data/roshar/progress.ts');

const unitWorkById = new Map([
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
