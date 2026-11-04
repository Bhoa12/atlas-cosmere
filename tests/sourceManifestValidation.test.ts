import { describe, expect, it } from 'vitest';
import {
  PRIVATE_SOURCE_MANIFEST,
  SourceWorkManifest,
} from '../src/data/privateSourceManifest';
import { validateSourceManifest } from '../src/domain/sourceManifestValidation';

describe('validateSourceManifest', () => {
  it('accepts the checked-in private bibliographic manifest', () => {
    expect(validateSourceManifest(PRIVATE_SOURCE_MANIFEST)).toEqual([]);
  });

  it('reports duplicate and empty identifiers', () => {
    const entries: SourceWorkManifest[] = [
      {
        id: 'work',
        title: 'One',
        sourceCollection: 'cosmere.epub',
        status: 'catalogued',
      },
      {
        id: 'work',
        title: 'Two',
        sourceCollection: 'cosmere.epub',
        status: 'catalogued',
      },
      {
        id: '   ',
        title: 'Three',
        sourceCollection: 'cosmere.epub',
        status: 'catalogued',
      },
    ];

    const issues = validateSourceManifest(entries);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ index: 1, field: 'id', message: 'id must be unique' }),
        expect.objectContaining({ index: 2, field: 'id', message: 'id must not be empty' }),
      ]),
    );
  });

  it('reports missing titles without interpreting editorial content', () => {
    const entries = [
      {
        id: 'metadata-only',
        title: ' ',
        sourceCollection: 'cosmere.epub' as const,
        status: 'catalogued' as const,
      },
    ];

    expect(validateSourceManifest(entries)).toEqual([
      expect.objectContaining({ field: 'title', message: 'title must not be empty' }),
    ]);
  });

  it('rejects unknown processing statuses at runtime', () => {
    const entries = [
      {
        id: 'invalid-status',
        title: 'Metadata',
        sourceCollection: 'cosmere.epub',
        status: 'unknown',
      },
    ] as unknown as SourceWorkManifest[];

    expect(validateSourceManifest(entries)).toEqual([
      expect.objectContaining({ field: 'status', message: 'status is not recognised' }),
    ]);
  });
});
