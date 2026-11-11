import { resolveRegistrySpoilerGate } from './registrySpoilerGate';

const registry = [
  { id: 'unit-a', workId: 'el-imperio-final', label: 'A', position: 1 },
  { id: 'unit-b', workId: 'el-imperio-final', label: 'B', position: 2 },
];

describe('resolveRegistrySpoilerGate', () => {
  it('blocks content that references an unknown technical unit', () => {
    expect(resolveRegistrySpoilerGate(
      { id: 'content-a', requiredUnitIds: ['unit-missing'], payload: 'x' },
      ['unit-missing'],
      registry,
    )).toEqual({ status: 'blocked', reason: 'unknown_required_unit' });
  });

  it('delegates visibility only after registry references are valid', () => {
    expect(resolveRegistrySpoilerGate(
      { id: 'content-a', requiredUnitIds: ['unit-a'], payload: 'x' },
      ['unit-a'],
      registry,
    )).toEqual({ status: 'visible', content: 'x' });
  });

  it('fails closed when the registry is malformed', () => {
    expect(resolveRegistrySpoilerGate(
      { id: 'content-a', requiredUnitIds: ['unit-a'], payload: 'x' },
      ['unit-a'],
      [{ id: 'unit-a' }],
    )).toEqual({ status: 'blocked', reason: 'invalid_registry' });
  });
});
