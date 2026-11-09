import { HoidKnowledgeCatalog } from './catalog';

describe('HoidKnowledgeCatalog metadata isolation', () => {
  it('does not let caller mutations change an existing catalog authorization boundary', () => {
    const entry = {
      id: 'stable-entry',
      aliases: ['Nombre inicial'],
      kind: 'concept' as const,
      firstSafeAppearance: { bookId: 'libro', chapter: 5 },
    };
    const entries = [entry];
    const catalog = new HoidKnowledgeCatalog(entries);

    entries.push({
      id: 'later-entry',
      aliases: ['Añadido después'],
      kind: 'concept',
      firstSafeAppearance: { bookId: 'libro', chapter: 1 },
    });
    entry.aliases[0] = 'Nombre mutado';
    entry.firstSafeAppearance.chapter = 1;

    expect(catalog.findMatches('Nombre inicial')).toHaveLength(1);
    expect(catalog.findMatches('Nombre mutado')).toHaveLength(0);
    expect(catalog.lockedMatches('Nombre inicial', [{ bookId: 'libro', chapter: 4 }])).toHaveLength(1);
    expect(catalog.findMatches('Añadido después')).toHaveLength(0);
  });
});
