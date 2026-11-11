import { resolveSpoilerGate } from './antiSpoilerPolicy';

describe('resolveSpoilerGate', () => {
  const content = {
    id: 'content-1',
    requiredUnitIds: ['unit-1', 'unit-2'],
    payload: { label: 'safe after progress' },
  };

  it('reveals content only when every required unit is completed', () => {
    expect(resolveSpoilerGate(content, ['unit-1', 'unit-2'])).toEqual({
      status: 'visible',
      content: content.payload,
    });
  });

  it('blocks incomplete progress', () => {
    expect(resolveSpoilerGate(content, ['unit-1'])).toEqual({
      status: 'blocked',
      reason: 'incomplete_progress',
    });
  });

  it('fails closed for malformed or duplicate identifiers', () => {
    expect(resolveSpoilerGate(
      { ...content, requiredUnitIds: ['unit-1', 'unit-1'] },
      ['unit-1'],
    )).toEqual({ status: 'blocked', reason: 'invalid_content' });
  });
});
