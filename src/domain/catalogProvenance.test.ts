import { describe, expect, it } from 'vitest';
import { validateCatalogProvenance } from './catalogProvenance';
import { BibliographicSource } from './bibliographicSources';
import { WorldCatalogEntry } from './cosmereCatalog';

const worlds: readonly WorldCatalogEntry[] = [{
  id: 'scadrial',
  name: 'Scadrial',
  works: [{
    id: 'mistborn-final-empire',
    worldId: 'scadrial',
    title: 'El Imperio Final',
    sequence: 1,
    format: 'novel',
    units: [],
  }],
}];

const sources: readonly BibliographicSource[] = [{
  id: 'cosmere-epub',
  label: 'cosmere.epub',
  works: ['El Imperio Final'],
}];

describe('catalog provenance validation', () => {
  it('accepts an explicit link to a declared title', () => {
    expect(validateCatalogProvenance(
      worlds,
      [{ workId: 'mistborn-final-empire', sourceId: 'cosmere-epub' }],
      sources,
    )).toEqual([]);
  });

  it('reports an unknown source instead of guessing one', () => {
    expect(validateCatalogProvenance(
      worlds,
      [{ workId: 'mistborn-final-empire', sourceId: 'missing' }],
      sources,
    )).toEqual([{
      code: 'unknown_source',
      workId: 'mistborn-final-empire',
      sourceId: 'missing',
    }]);
  });

  it('rejects attribution when the source does not declare the catalog title', () => {
    expect(validateCatalogProvenance(
      worlds,
      [{ workId: 'mistborn-final-empire', sourceId: 'source-a' }],
      [{ id: 'source-a', label: 'A', works: ['Otro título'] }],
    )).toEqual([{
      code: 'work_not_declared_by_source',
      workId: 'mistborn-final-empire',
      sourceId: 'source-a',
    }]);
  });
});
