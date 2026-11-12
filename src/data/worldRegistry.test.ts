import {
  resolveRegisteredWorld,
  validateWorldIdCollection,
} from './worldRegistry';

describe('worldRegistry', () => {
  it('resolves explicitly registered technical world IDs', () => {
    expect(resolveRegisteredWorld('scadrial')?.label).toBe('Scadrial');
    expect(resolveRegisteredWorld('sel')?.label).toBe('Sel');
    expect(resolveRegisteredWorld('nalthis')?.label).toBe('Nalthis');
    expect(resolveRegisteredWorld('taldain')?.label).toBe('Taldain');
  });

  it('fails closed for malformed or unknown IDs', () => {
    expect(resolveRegisteredWorld(' scadrial')).toBeUndefined();
    expect(resolveRegisteredWorld('unknown-world')).toBeUndefined();
  });

  it('accepts an empty assignment without treating it as unknown', () => {
    expect(validateWorldIdCollection([])).toEqual({
      status: 'valid',
      worldIds: [],
    });
  });

  it('blocks duplicates and unknown worlds', () => {
    expect(validateWorldIdCollection(['scadrial', 'scadrial'])).toEqual({
      status: 'blocked',
      reason: 'invalid_world_ids',
    });
    expect(validateWorldIdCollection(['unknown-world'])).toEqual({
      status: 'blocked',
      reason: 'unknown_world',
    });
  });
});
