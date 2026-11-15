import type { ExpansionCatalog } from './cosmereCatalog';
import { nextReadingUnit, reconcileWorkProgress } from './cosmereProgress';

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const catalog: ExpansionCatalog = {
  sources: [
    {
      id: 'editorial',
      label: 'Fuente de prueba accesible',
      kind: 'editorial-accessible',
      accessibleForEditorialClaims: true,
    },
  ],
  worlds: [],
  works: [
    { id: 'first', title: 'Primera obra', sourceId: 'editorial' },
    { id: 'second', title: 'Segunda obra', sourceId: 'editorial' },
  ],
  readingUnits: [
    { id: 'first-2', workId: 'first', position: 2, sourceId: 'editorial' },
    { id: 'first-1', workId: 'first', position: 1, sourceId: 'editorial' },
    { id: 'second-1', workId: 'second', position: 1, sourceId: 'editorial' },
  ],
  spoilerGates: [],
};

const snapshot = reconcileWorkProgress(catalog, {
  workId: 'first',
  completedUnitIds: ['unknown', 'second-1', 'first-1', 'first-1'],
});
expect(snapshot.completedKnownUnits === 1, 'Only known units from the same work count');
expect(snapshot.completedUnitIds[0] === 'first-1', 'Progress must use explicit reading order');
expect(!snapshot.isComplete, 'Partial progress must not be complete');

const next = nextReadingUnit(catalog, {
  workId: 'first',
  completedUnitIds: ['first-1'],
});
expect(next?.id === 'first-2', 'The next unit must follow explicit position');

const completed = reconcileWorkProgress(catalog, {
  workId: 'first',
  completedUnitIds: ['first-2', 'first-1'],
});
expect(completed.isComplete, 'All explicit units should complete the work');

const unknown = reconcileWorkProgress(catalog, {
  workId: 'missing',
  completedUnitIds: ['anything'],
});
expect(unknown.totalKnownUnits === 0 && !unknown.isComplete, 'Unknown works must fail closed');

const empty: ExpansionCatalog = { ...catalog, readingUnits: [] };
expect(
  nextReadingUnit(empty, { workId: 'first', completedUnitIds: [] }) === null,
  'Missing reading structure must not be invented',
);
