import { canReveal, normalizeProgress, validateCatalog } from './cosmereExpansionRun61';

const catalog = {
  sources: [{ id: 'index', label: 'Index', kind: 'verified-index' as const }],
  worlds: [{ id: 'scadrial', label: 'Scadrial' }],
  works: [{ id: 'work', title: 'Work', sourceId: 'index' }],
  units: [{ id: 'u1', workId: 'work', position: 1, label: 'Unit 1' }, { id: 'u2', workId: 'work', position: 2, label: 'Unit 2' }]
};

describe('cosmere expansion run61', () => {
  it('accepts a structurally valid catalog without inferring worlds', () => {
    expect(validateCatalog(catalog)).toEqual([]);
    expect(catalog.works[0].worldId).toBeUndefined();
  });
  it('normalizes foreign and duplicate progress', () => {
    expect(normalizeProgress({ workId: 'work', completedUnitIds: ['u1','u1','missing'] }, catalog.units).completedUnitIds).toEqual(['u1']);
  });
  it('fails closed until every explicit requirement is complete', () => {
    const gate = { workId: 'work', requiredUnitIds: ['u1','u2'] };
    expect(canReveal(gate, { workId: 'work', completedUnitIds: ['u1'] }, catalog.units)).toBe(false);
    expect(canReveal(gate, { workId: 'work', completedUnitIds: ['u1','u2'] }, catalog.units)).toBe(true);
  });
  it('rejects duplicate requirements', () => {
    expect(canReveal({ workId: 'work', requiredUnitIds: ['u1','u1'] }, { workId: 'work', completedUnitIds: ['u1'] }, catalog.units)).toBe(false);
  });
});