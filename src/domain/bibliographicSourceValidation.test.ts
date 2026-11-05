import { describe, expect, it } from 'vitest';
import { PRIVATE_BIBLIOGRAPHIC_SOURCES } from './bibliographicSources';
import {
  hasValidBibliographicSources,
  validateBibliographicSources,
} from './bibliographicSourceValidation';

describe('bibliographic source validation', () => {
  it('accepts the declared private source manifest', () => {
    expect(validateBibliographicSources(PRIVATE_BIBLIOGRAPHIC_SOURCES)).toEqual([]);
    expect(hasValidBibliographicSources(PRIVATE_BIBLIOGRAPHIC_SOURCES)).toBe(true);
  });

  it('detects duplicate source identifiers and duplicate titles', () => {
    const issues = validateBibliographicSources([
      { id: 'source-a', label: 'A', works: ['Obra A'] },
      { id: 'source-a', label: 'B', works: ['Obra A'] },
    ]);

    expect(issues.map((issue) => issue.code)).toEqual([
      'duplicate_source_id',
      'duplicate_work_title',
    ]);
  });

  it('rejects blank provenance fields without inventing replacements', () => {
    const issues = validateBibliographicSources([
      { id: ' ', label: ' ', works: [' ', 'Obra válida'] },
    ]);

    expect(issues.map((issue) => issue.code)).toEqual([
      'empty_source_id',
      'empty_source_label',
      'empty_work_title',
    ]);
  });
});
