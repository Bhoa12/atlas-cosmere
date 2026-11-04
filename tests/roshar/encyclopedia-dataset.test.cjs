require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const dataset = require('../../src/data/roshar/encyclopedia/dataset.ts');
const selectors = require('../../src/data/roshar/encyclopedia/selectors.ts');

test('publication dataset starts empty rather than inventing canonical claims', () => {
  assert.equal(dataset.ROSHAR_ENCYCLOPEDIA_DATASET.entities.length, 0);
  assert.equal(dataset.ROSHAR_ENCYCLOPEDIA_DATASET.claims.length, 0);
});

test('source registry and policy support a review-first pipeline', () => {
  assert.ok(dataset.ROSHAR_ENCYCLOPEDIA_DATASET.sources.length >= 3);
  assert.equal(dataset.ROSHAR_ENCYCLOPEDIA_DATASET.policy.publishOnlyReviewedClaims, true);
  assert.equal(
    selectors.validateEncyclopediaContent(
      dataset.ROSHAR_ENCYCLOPEDIA_DATASET.entities,
      dataset.ROSHAR_ENCYCLOPEDIA_DATASET.claims,
      dataset.ROSHAR_ENCYCLOPEDIA_DATASET.sources
    ).length,
    0
  );
});
