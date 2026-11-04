require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReadingUnits, validateSpoilerGate } = require('../../src/data/roshar/model.ts');

const unit = (id, ordinal, extra = {}) => ({
  id, workId: 'twok', ordinal, kind: 'chapter', label: `Chapter ${ordinal}`,
  chapterNumber: ordinal, ...extra
});

test('accepts a structurally valid reading-unit catalog', () => {
  assert.deepEqual(validateReadingUnits(['twok'], [unit('twok:chapter:001', 1)]), []);
});

test('reports duplicate IDs, unknown works, invalid ordinals and chapter numbers', () => {
  const issues = validateReadingUnits(
    ['twok'],
    [
      unit('same-id', 0, { chapterNumber: 0 }),
      unit('same-id', 0, { chapterNumber: 0, workId: 'unknown' })
    ]
  );
  const codes = issues.map(issue => issue.code);
  assert.ok(codes.includes('duplicate-id'));
  assert.ok(codes.includes('unknown-work'));
  assert.ok(codes.includes('invalid-ordinal'));
  assert.ok(codes.includes('duplicate-ordinal'));
  assert.ok(codes.includes('invalid-chapter-number'));
});

test('allows the same ordinal in different works', () => {
  const units = [
    unit('twok:chapter:001', 1),
    unit('wor:chapter:001', 1, { workId: 'wor' })
  ];
  assert.deepEqual(validateReadingUnits(['twok', 'wor'], units), []);
});

test('requires at least one known unit in a spoiler gate', () => {
  assert.equal(validateSpoilerGate({ allOf: [], anyOf: [] }, new Set()).length, 1);
  const issues = validateSpoilerGate(
    { allOf: [{ workId: 'twok', readingUnitId: 'missing' }] },
    new Set(['twok:chapter:001'])
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].itemId, 'missing');
});
