require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const selectors = require('../../src/data/roshar/encyclopedia/selectors.ts');

test('projection omits entities without visible claims', () => {
  const entities = [
    { id: 'e1', planetId: 'roshar', type: 'concept', canonicalName: 'Visible', aliases: [] },
    { id: 'e2', planetId: 'roshar', type: 'concept', canonicalName: 'Hidden', aliases: [] }
  ];
  const claims = [
    { id: 'c1', entityId: 'e1', sectionKey: 'summary', text: 'Safe', claimType: 'fact', editorialStatus: 'published', confidence: 'confirmed', sourceRefs: ['s1'], spoilerGate: { allOf: [{ workId: 'twok', readingUnitId: 'twok:chapter:001' }] } },
    { id: 'c2', entityId: 'e2', sectionKey: 'summary', text: 'Later', claimType: 'fact', editorialStatus: 'published', confidence: 'confirmed', sourceRefs: ['s1'], spoilerGate: { allOf: [{ workId: 'twok', readingUnitId: 'twok:chapter:002' }] } }
  ];
  const progress = [{ workId: 'twok', completedUnitIds: ['twok:chapter:001'], updatedAt: 't0' }];
  const result = selectors.selectVisibleEncyclopediaEntities(entities, claims, progress);
  assert.deepEqual(result.map(item => item.entity.id), ['e1']);
});

test('validation reports unknown references', () => {
  const issues = selectors.validateEncyclopediaContent(
    [{ id: 'known', planetId: 'roshar', type: 'concept', canonicalName: 'Known', aliases: [] }],
    [{ id: 'c', entityId: 'missing', sectionKey: 'summary', text: 'x', claimType: 'fact', editorialStatus: 'published', confidence: 'confirmed', sourceRefs: ['missing'], spoilerGate: { allOf: [{ workId: 'twok', readingUnitId: 'missing' }] } }],
    []
  );
  assert.ok(issues.length >= 3);
});
