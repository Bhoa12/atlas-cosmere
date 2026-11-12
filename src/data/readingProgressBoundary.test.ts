import { canReveal } from './readingProgressBoundary';

describe('canReveal', () => {
  const gate = { id: 'safe-note', workId: 'work-demo', requiredUnitIds: ['unit-one'] };
  it('allows only completed requirements from the same work', () => {
    expect(canReveal(gate, { workId: 'work-demo', completedUnitIds: ['unit-one'] })).toBe(true);
  });
  it('fails closed for another work or duplicate progress', () => {
    expect(canReveal(gate, { workId: 'other-work', completedUnitIds: ['unit-one'] })).toBe(false);
    expect(canReveal(gate, { workId: 'work-demo', completedUnitIds: ['unit-one', 'unit-one'] })).toBe(false);
  });
});
