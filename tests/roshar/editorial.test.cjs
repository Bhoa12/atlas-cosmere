require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectEditorialBatch } = require('../../src/data/roshar/encyclopedia/editorial.ts');

test('draft batches can be inspected without becoming publication content', () => {
  const result = inspectEditorialBatch({
    entities: [],
    claims: [],
    sources: []
  });
  assert.equal(result.publishable, true);
  assert.equal(result.publishedClaimCount, 0);
});

test('invalid published material blocks an editorial batch', () => {
  const result = inspectEditorialBatch({
    entities: [{ id: 'e', planetId: 'roshar', type: 'concept', canonicalName: 'E', aliases: [] }],
    claims: [{
      id: 'c', entityId: 'e', sectionKey: 'summary', text: 'x',
      claimType: 'fact', editorialStatus: 'published', confidence: 'confirmed',
      sourceRefs: [], spoilerGate: { allOf: [] }
    }],
    sources: []
  });
  assert.equal(result.publishable, false);
  assert.ok(result.issues.length > 0);
});
