import { describe, expect, it } from 'vitest';
import { validateCatalogIntegrity } from './catalogIntegrity';
import { WorldCatalogEntry } from './cosmereCatalog';

const worlds: readonly WorldCatalogEntry[] = [{
  id: 'sel',
  name: 'Sel',
  works: [{
    id: 'elantris',
    worldId: 'sel',
    title: 'Elantris',
    sequence: 1,
    format: 'novel',
    units: [],
  }],
}];

describe('catalog integrity', () => {
  it('accepts exactly one explicit provenance link for every catalog work', () => {
    expect(validateCatalogIntegrity(worlds, [{ workId: 'elantris', sourceId: 'cosmere-epub' }], [])).toEqual([]);
  });

  it('reports catalog works without provenance instead of assigning a source', () => {
    expect(validateCatalogIntegrity(worlds, [], [])).toEqual([{ code: 'missing_provenance', workId: 'elantris' }]);
  });

  it('reports duplicate links and unknown work ids', () => {
    expect(validateCatalogIntegrity(worlds, [
      { workId: 'elantris', sourceId: 'a' },
      { workId: 'elantris', sourceId: 'b' },
      { workId: 'unknown', sourceId: 'a' },
    ], [])).toEqual([
      { code: 'unknown_catalog_work', workId: 'unknown' },
      { code: 'duplicate_provenance_link', workId: 'elantris' },
    ]);
  });
});
