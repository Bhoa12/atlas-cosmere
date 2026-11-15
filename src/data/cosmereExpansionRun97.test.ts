import { auditManifest, isGateUnlocked, reconcileProgress } from './cosmereExpansionRun97';

const base = {
  accessibleSourceIds: ['catalog'],
  worlds: [{ id: 'scadrial', name: 'Scadrial', sourceId: 'catalog' }],
  works: [{ id: 'work', title: 'Catalog title', sourceId: 'catalog' }],
  links: [{ workId: 'work', worldId: 'scadrial', sourceId: 'catalog' }],
  units: [
    { id: 'u1', workId: 'work', position: 1, sourceId: 'catalog' },
    { id: 'u2', workId: 'work', position: 2, sourceId: 'catalog' },
  ],
};

describe('cosmere expansion run 97', () => {
  it('audits only explicit references', () => {
    expect(auditManifest({ ...base, gates: [{ id: 'g', workId: 'work', requiredUnitIds: ['u1'] }] }).valid).toBe(true);
  });
  it('fails closed for invalid gates', () => {
    const units = base.units;
    expect(isGateUnlocked({ id: 'g', workId: 'work', requiredUnitIds: [] }, 'work', ['u1'], units)).toBe(false);
    expect(isGateUnlocked({ id: 'g', workId: 'work', requiredUnitIds: ['u1', 'u1'] }, 'work', ['u1'], units)).toBe(false);
  });
  it('isolates and orders progress by work', () => {
    expect(reconcileProgress('work', ['u2', 'unknown', 'u1', 'u2'], base.units)).toEqual(['u1', 'u2']);
  });
});