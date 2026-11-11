import { validateWorkProgressConsistency } from './workProgressConsistency';

const registry = [
  { id: 'unit-a', workId: 'mistborn-final-empire', label: 'A', position: 1 },
  { id: 'unit-b', workId: 'elantris', label: 'B', position: 1 },
];

describe('validateWorkProgressConsistency', () => {
  it('accepts progress whose units all belong to the declared catalog work', () => {
    expect(validateWorkProgressConsistency(
      { workId: 'mistborn-final-empire', completedUnitIds: ['unit-a'] },
      registry,
    )).toEqual({
      status: 'valid',
      progress: { workId: 'mistborn-final-empire', completedUnitIds: ['unit-a'] },
    });
  });

  it('blocks an unknown work instead of inferring one', () => {
    expect(validateWorkProgressConsistency(
      { workId: 'unknown-work', completedUnitIds: [] },
      registry,
    )).toEqual({ status: 'blocked', reason: 'unknown_work' });
  });

  it('blocks completed units from another work', () => {
    expect(validateWorkProgressConsistency(
      { workId: 'mistborn-final-empire', completedUnitIds: ['unit-b'] },
      registry,
    )).toEqual({ status: 'blocked', reason: 'cross_work_completed_unit' });
  });

  it('blocks duplicate or malformed progress identifiers', () => {
    expect(validateWorkProgressConsistency(
      { workId: 'mistborn-final-empire', completedUnitIds: ['unit-a', 'unit-a'] },
      registry,
    )).toEqual({ status: 'blocked', reason: 'invalid_progress' });

    expect(validateWorkProgressConsistency(
      { workId: 'mistborn-final-empire', completedUnitIds: [' unit-a'] },
      registry,
    )).toEqual({ status: 'blocked', reason: 'invalid_progress' });
  });
});
