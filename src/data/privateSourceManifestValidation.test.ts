import { validatePrivateSourceManifest } from './privateSourceManifestValidation';
import type { SourceWorkManifest } from './privateSourceManifest';

const valid: SourceWorkManifest[] = [
  { id: 'work-a', title: 'Obra A', sourceCollection: 'cosmere.epub', status: 'catalogued' },
];

describe('validatePrivateSourceManifest', () => {
  it('accepts valid bibliographic metadata', () => {
    expect(validatePrivateSourceManifest(valid)).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    expect(validatePrivateSourceManifest([...valid, { ...valid[0], title: 'Otra obra' }]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'duplicate-id' })]));
  });

  it('rejects missing titles', () => {
    expect(validatePrivateSourceManifest([{ ...valid[0], title: ' ' }]))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'missing-title' })]));
  });
});
