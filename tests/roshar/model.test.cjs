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
      unit('same-id', 0, { chapterNumber: 0 }),
      unit('different-id', 0, { chapterNumber: 0 }),
      unit('unknown-work', 2, { workId: 'unknown' })
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


test('validates section containers and edition-specific unit locators', () => {
  const sections = [{
    id: 'twok:part:1',
    workId: 'twok',
    kind: 'part',
    label: 'Primera parte',
    ordinal: 1
  }];
  const editions = [{
    id: 'twok-user-epub',
    workId: 'twok',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: 'user.epub',
    navigationDocument: 'NCX',
    isbn: null
  }];
  const valid = unit('twok:prologue', 1, {
    kind: 'prologue',
    chapterNumber: undefined,
    sectionId: 'twok:part:1',
    source: { editionVariantId: 'twok-user-epub', locator: 'Text/prologue.xhtml' }
  });
  assert.deepEqual(validateReadingUnits(['twok'], [valid], sections, editions), []);
});

test('rejects unknown section and mismatched edition source', () => {
  const invalid = unit('twok:chapter:001', 1, {
    sectionId: 'missing-section',
    source: { editionVariantId: 'other-work-edition', locator: 'Text/1.xhtml' }
  });
  const issues = validateReadingUnits(['twok'], [invalid], [], [{
    id: 'other-work-edition',
    workId: 'wor',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: 'other.epub',
    navigationDocument: 'NCX',
    isbn: null
  }]);
  assert.ok(issues.some(issue => issue.code === 'invalid-section'));
  assert.ok(issues.some(issue => issue.code === 'invalid-source'));
});
