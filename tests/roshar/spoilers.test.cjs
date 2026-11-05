require('./register-typescript.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isSpoilerGateSatisfied,
  selectVisibleClaims,
  isEntityFullyRevealed,
  selectVisibleClaimsForEntity,
  selectVisibleClaimsForSearch
} = require('../../src/data/roshar/spoilers.ts');

const unitWorkById = new Map([
  ['twok:prologue', 'twok'],
  ['twok:chapter:001', 'twok'],
  ['wor:chapter:001', 'wor']
]);
const req = (workId, readingUnitId) => ({ workId, readingUnitId });

test('fails closed for absent, empty and malformed gates', () => {
  const completed = new Set(['twok:prologue']);
  assert.equal(isSpoilerGateSatisfied(undefined, completed, unitWorkById), false);
  assert.equal(isSpoilerGateSatisfied({ allOf: [] }, completed, unitWorkById), false);
  assert.equal(isSpoilerGateSatisfied({ allOf: null }, completed, unitWorkById), false);
});

test('requires every allOf requirement', () => {
  const gate = { allOf: [req('twok', 'twok:prologue'), req('twok', 'twok:chapter:001')] };
  assert.equal(isSpoilerGateSatisfied(gate, new Set(['twok:prologue']), unitWorkById), false);
  assert.equal(isSpoilerGateSatisfied(gate, new Set(['twok:prologue', 'twok:chapter:001']), unitWorkById), true);
});

test('supports anyOf-only gates and rejects mismatched work IDs', () => {
  const gate = { allOf: [], anyOf: [req('twok', 'twok:chapter:001'), req('wor', 'wor:chapter:001')] };
  assert.equal(isSpoilerGateSatisfied(gate, new Set(['wor:chapter:001']), unitWorkById), true);
  assert.equal(isSpoilerGateSatisfied(
    { allOf: [req('wor', 'twok:prologue')] },
    new Set(['twok:prologue']),
    unitWorkById
  ), false);
});

test('returns only published, sourced claims whose gates are satisfied', () => {
  const claims = [
    { id: 'visible', entityId: 'kaladin', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } },
    { id: 'locked', entityId: 'kaladin', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:chapter:001')] } },
    { id: 'draft', entityId: 'kaladin', editorialStatus: 'draft', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } },
    { id: 'unsourced', entityId: 'kaladin', editorialStatus: 'published', sourceRefs: [], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } }
  ];
  const visible = selectVisibleClaims(claims, [{ workId: 'twok', completedUnitIds: ['twok:prologue'], updatedAt: '2026-01-01' }], unitWorkById);
  assert.deepEqual(visible.map(claim => claim.id), ['visible']);
});

test('an entity is fully revealed only when all its published claims are visible', () => {
  const claims = [
    { id: 'a', entityId: 'kaladin', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } },
    { id: 'b', entityId: 'kaladin', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:chapter:001')] } }
  ];
  const progress = [{ workId: 'twok', completedUnitIds: ['twok:prologue'], updatedAt: '2026-01-01' }];
  assert.equal(isEntityFullyRevealed(claims, 'kaladin', progress, unitWorkById), false);
  progress[0].completedUnitIds.push('twok:chapter:001');
  assert.equal(isEntityFullyRevealed(claims, 'kaladin', progress, unitWorkById), true);
});


test('entity selector returns only visible claims and no empty entity placeholder', () => {
  const claims = [
    { id: 'visible', entityId: 'kaladin', text: 'A visible fact', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } },
    { id: 'locked', entityId: 'kaladin', text: 'A hidden fact', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:chapter:001')] } }
  ];
  const progress = [{ workId: 'twok', completedUnitIds: ['twok:prologue'], updatedAt: 't0' }];
  assert.deepEqual(selectVisibleClaimsForEntity(claims, 'kaladin', progress, unitWorkById).map(item => item.id), ['visible']);
  assert.deepEqual(selectVisibleClaimsForEntity(claims, 'unknown', progress, unitWorkById), []);
});

test('search matches visible claim text only and never matches locked claim text', () => {
  const claims = [
    { id: 'visible', entityId: 'kaladin', text: 'Kaladin trains with the bridge crew', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } },
    { id: 'locked', entityId: 'kaladin', text: 'Kaladin discovers a hidden secret', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:chapter:001')] } }
  ];
  const progress = [{ workId: 'twok', completedUnitIds: ['twok:prologue'], updatedAt: 't0' }];
  assert.deepEqual(selectVisibleClaimsForSearch(claims, progress, unitWorkById, 'bridge').map(item => item.id), ['visible']);
  assert.deepEqual(selectVisibleClaimsForSearch(claims, progress, unitWorkById, 'hidden secret'), []);
  assert.deepEqual(selectVisibleClaimsForSearch(claims, progress, unitWorkById, '   '), []);
});


test('duplicate progress records fail closed and cannot combine into spoiler access', () => {
  const claims = [
    { id: 'guarded', entityId: 'kaladin', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: {
      allOf: [req('twok', 'twok:prologue'), req('twok', 'twok:chapter:001')]
    } }
  ];
  const ambiguous = [
    { workId: 'twok', completedUnitIds: ['twok:prologue'], updatedAt: 't0' },
    { workId: 'twok', completedUnitIds: ['twok:chapter:001'], updatedAt: 't1' }
  ];
  assert.deepEqual(selectVisibleClaims(claims, ambiguous, unitWorkById), []);

  const unambiguous = [{
    workId: 'twok',
    completedUnitIds: ['twok:prologue', 'twok:chapter:001'],
    updatedAt: 't2'
  }];
  assert.deepEqual(selectVisibleClaims(claims, unambiguous, unitWorkById).map(item => item.id), ['guarded']);
});


test('malformed persisted progress fails closed instead of throwing or unlocking content', () => {
  const claims = [{ id: 'guarded', entityId: 'x', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } }];
  const malformed = [
    { workId: 'twok', completedUnitIds: null, updatedAt: 't0' },
    { workId: 42, completedUnitIds: ['twok:prologue'], updatedAt: 't1' },
    null
  ];
  assert.deepEqual(selectVisibleClaims(claims, malformed, unitWorkById), []);
});


test('search fails closed for malformed claim text', () => {
  const claims = [{ id: 'bad', entityId: 'x', text: null, editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } }];
  const progress = [{ workId: 'twok', completedUnitIds: ['twok:prologue'], updatedAt: 't0' }];
  assert.deepEqual(selectVisibleClaimsForSearch(claims, progress, unitWorkById, 'anything'), []);
});


test('search fails closed for malformed queries', () => {
  const claims = [{ id: 'visible', entityId: 'x', text: 'safe text', editorialStatus: 'published', sourceRefs: ['ref'], spoilerGate: { allOf: [req('twok', 'twok:prologue')] } }];
  const progress = [{ workId: 'twok', completedUnitIds: ['twok:prologue'], updatedAt: 't0' }];
  assert.deepEqual(selectVisibleClaimsForSearch(claims, progress, unitWorkById, null), []);
  assert.deepEqual(selectVisibleClaimsForSearch(claims, progress, unitWorkById, { trim() {} }), []);
});
