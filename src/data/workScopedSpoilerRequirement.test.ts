import { validateWorkScopedSpoilerRequirement } from './workScopedSpoilerRequirement';

// These examples use technical IDs only. They do not assert editorial structure.
describe('validateWorkScopedSpoilerRequirement', () => {
  it('blocks malformed requirements', () => {
    expect(validateWorkScopedSpoilerRequirement(null, [])).toEqual({
      status: 'blocked',
      reason: 'invalid_requirement',
    });
  });

  it('is fail-closed for an invalid registry', () => {
    expect(
      validateWorkScopedSpoilerRequirement(
        { workId: 'unknown-work', requiredUnitIds: [] },
        null,
      ),
    ).toMatchObject({ status: 'blocked' });
  });
});
