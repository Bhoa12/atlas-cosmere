import { describe, expect, it } from 'vitest';
import { PRIVATE_BIBLIOGRAPHIC_SOURCES, getSourceForWork } from './bibliographicSources';

describe('bibliographic source manifest', () => {
  it('keeps source identifiers unique and non-empty', () => {
    const ids = PRIVATE_BIBLIOGRAPHIC_SOURCES.map((source) => source.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('traces verified catalog titles to their declared private source', () => {
    expect(getSourceForWork('El Imperio Final')?.id).toBe('cosmere-epub');
    expect(getSourceForWork('Esquirla del amanecer')?.id).toBe('roshar-private-epubs');
  });

  it('does not fabricate a source for undeclared works', () => {
    expect(getSourceForWork('Obra no declarada')).toBeUndefined();
  });
});
