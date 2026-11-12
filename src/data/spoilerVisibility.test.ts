import { resolveContentVisibility } from './spoilerVisibility';

const content = { id: 'content-1', workId: 'work-1', requiredUnitIds: ['unit-1'] };

if (resolveContentVisibility(content, ['unit-1']) !== 'visible') {
  throw new Error('Expected completed requirement to reveal content');
}
if (resolveContentVisibility(content, []) !== 'locked') {
  throw new Error('Expected missing requirement to lock content');
}
if (resolveContentVisibility(content, ['unit-1', 'unit-1']) !== 'locked') {
  throw new Error('Expected duplicate progress data to fail closed');
}
