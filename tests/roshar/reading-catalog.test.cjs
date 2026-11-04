require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ROSHAR_READING_UNITS,
  ROSHAR_READING_SECTIONS,
  ROSHAR_NCX_EXPECTED_CHAPTER_COUNTS,
  validateRosharReadingCatalog
} = require('../../src/data/roshar/catalog/readingUnits.ts');

test('imports the complete NCX chapter inventory for all seven supplied works', () => {
  for (const [workId, expected] of Object.entries(ROSHAR_NCX_EXPECTED_CHAPTER_COUNTS)) {
    const actual = ROSHAR_READING_UNITS.filter(unit => unit.workId === workId && unit.kind === 'chapter');
    assert.equal(actual.length, expected, workId);
    assert.deepEqual(actual.map(unit => unit.chapterNumber), Array.from({ length: expected }, (_, i) => i + 1), workId);
  }
});

test('all imported units have unique IDs, contiguous progress ordinals and edition locators', () => {
  assert.equal(ROSHAR_READING_UNITS.length, 684);
  assert.equal(new Set(ROSHAR_READING_UNITS.map(unit => unit.id)).size, 684);
  for (const workId of Object.keys(ROSHAR_NCX_EXPECTED_CHAPTER_COUNTS)) {
    const units = ROSHAR_READING_UNITS.filter(unit => unit.workId === workId);
    assert.deepEqual(units.map(unit => unit.ordinal), units.map((_, i) => i + 1), workId);
    for (const unit of units) {
      assert.ok(unit.source.editionVariantId);
      assert.ok(unit.source.locator);
    }
  }
});

test('preserves parts, interlude blocks and the ten day headings as structural sections', () => {
  assert.equal(ROSHAR_READING_SECTIONS.length, 54);
  assert.equal(ROSHAR_READING_SECTIONS.filter(section => section.workId === 'wat' && section.kind === 'day').length, 10);
  assert.equal(ROSHAR_READING_SECTIONS.filter(section => section.kind === 'part').length, 20);
  assert.equal(ROSHAR_READING_SECTIONS.filter(section => section.kind === 'interludes-block').length, 24);
});

test('preserves source anomalies without silently reclassifying them', () => {
  const watAnomalies = ROSHAR_READING_UNITS.filter(unit => unit.workId === 'wat' && unit.kind === 'other');
  assert.deepEqual(watAnomalies.map(unit => unit.label), ['12. El dios divino', '14. La lección equivocada']);
  assert.equal(ROSHAR_READING_UNITS.filter(unit => unit.workId === 'o' && unit.kind === 'prologue').length, 2);
});

test('catalog validation reports no structural or edition-provenance errors', () => {
  assert.deepEqual(validateRosharReadingCatalog(), []);
});
