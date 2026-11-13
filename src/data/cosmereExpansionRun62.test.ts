import { evaluateReveal, validateWorldWorkRelations } from './cosmereExpansionRun62';

const catalog = {
  sources: [{ id: 'index', label: 'Verified index', kind: 'verified-index' as const }],
  worlds: [{ id: 'scadrial', label: 'Scadrial' }],
  works: [{ id: 'work', title: 'Work', sourceId: 'index' }],
  units: [
    { id: 'u1', workId: 'work', position: 1, label: 'Unit 1' },
    { id: 'u2', workId: 'work', position: 2, label: 'Unit 2' },
    { id: 'other', workId: 'other-work', position: 1, label: 'Other' },
  ],
};

describe('cosmere expansion run62', () => {
  const gate = { workId: 'work', requiredUnitIds: ['u1', 'u2'] };

  it('explains incomplete spoiler gates without editorial content', () => {
    const result = evaluateReveal(gate, { workId: 'work', completedUnitIds: ['u1'] }, catalog.units);
    expect(result).toMatchObject({ allowed: false, code: 'incomplete-progress', missingUnitIds: ['u2'] });
  });

  it('fails closed for foreign requirements', () => {
    const result = evaluateReveal({ workId: 'work', requiredUnitIds: ['other'] }, { workId: 'work', completedUnitIds: ['other'] }, catalog.units);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('unknown-or-foreign-requirement');
  });

  it('records only explicit, source-backed world/work relations', () => {
    expect(validateWorldWorkRelations(catalog, [{ worldId: 'scadrial', workId: 'work', sourceId: 'index' }])).toEqual([]);
    expect(validateWorldWorkRelations(catalog, [
      { worldId: 'scadrial', workId: 'work', sourceId: 'index' },
      { worldId: 'scadrial', workId: 'work', sourceId: 'index' },
    ])).toEqual([{ code: 'duplicate-relation', index: 1 }]);
  });
});
