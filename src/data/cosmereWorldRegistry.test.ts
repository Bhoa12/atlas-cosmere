import {
  COSMERE_WORLD_REGISTRY,
  findCosmereWorld,
  hasValidCosmereWorldRegistry,
} from './cosmereWorldRegistry';

describe('cosmere world registry', () => {
  it('keeps the reusable priority world IDs available', () => {
    expect(COSMERE_WORLD_REGISTRY.map((world) => world.id)).toEqual([
      'scadrial',
      'sel',
      'nalthis',
      'taldain',
      'roshar',
    ]);
  });

  it('rejects non-canonical runtime identifiers', () => {
    expect(findCosmereWorld(' scadrial ')).toBeUndefined();
    expect(findCosmereWorld('')).toBeUndefined();
    expect(findCosmereWorld(null)).toBeUndefined();
  });

  it('fails closed for malformed or duplicate registry data', () => {
    expect(hasValidCosmereWorldRegistry(null)).toBe(false);
    expect(hasValidCosmereWorldRegistry([
      { id: 'scadrial', label: 'Scadrial' },
      { id: 'scadrial', label: 'Duplicate' },
    ])).toBe(false);
    expect(hasValidCosmereWorldRegistry([
      { id: 'sel ', label: 'Sel' },
    ])).toBe(false);
  });
});
