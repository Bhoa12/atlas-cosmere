import { describe, expect, it } from 'vitest';
import { validateWorkCatalog } from './workCatalogValidation';

describe('validateWorkCatalog', () => {
  const worlds = [{ id: 'scadrial', name: 'Scadrial' }];
  const works = [{ id: 'work-a', worldId: 'scadrial', title: 'Catalogued work', sourceId: 'source-a' }];

  it('accepts structurally valid metadata', () => {
    expect(validateWorkCatalog(worlds, works)).toEqual([]);
  });

  it('rejects works pointing to unknown worlds', () => {
    expect(validateWorkCatalog(worlds, [{ ...works[0], worldId: 'unknown' }]))
      .toContain('unknown worldId: unknown');
  });

  it('rejects duplicate work ids', () => {
    expect(validateWorkCatalog(worlds, [works[0], { ...works[0] }]))
      .toContain('duplicate work id: work-a');
  });

  it('requires a source id without treating it as editorial verification', () => {
    expect(validateWorkCatalog(worlds, [{ ...works[0], sourceId: '  ' }]))
      .toContain('work sourceId must not be empty: work-a');
  });
});
