import {
  auditExpansionCatalog,
  isSpoilerGateUnlocked,
  type ExpansionCatalog,
} from './cosmereCatalog';

const base: ExpansionCatalog = {
  sources: [{ id: 'index', label: 'Índice verificado', kind: 'verified-index', accessibleForEditorialClaims: false }],
  worlds: [],
  works: [{ id: 'work', title: 'Obra de prueba', sourceId: 'index' }],
  readingUnits: [],
  spoilerGates: [],
};

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const privateUnitCatalog: ExpansionCatalog = {
  ...base,
  readingUnits: [{ id: 'u1', workId: 'work', position: 1, sourceId: 'index' }],
};
expect(!auditExpansionCatalog(privateUnitCatalog).valid, 'A non-accessible source must not authorize a reading unit');

const accessible: ExpansionCatalog = {
  ...base,
  sources: [{ id: 'editorial', label: 'Fuente accesible', kind: 'editorial-accessible', accessibleForEditorialClaims: true }],
  works: [{ id: 'work', title: 'Obra de prueba', sourceId: 'editorial' }],
  readingUnits: [{ id: 'u1', workId: 'work', position: 1, sourceId: 'editorial' }],
  spoilerGates: [{ id: 'g1', workId: 'work', requiredUnitIds: ['u1'] }],
};
expect(auditExpansionCatalog(accessible).valid, 'Accessible explicit data should pass');
expect(!isSpoilerGateUnlocked(accessible, 'g1', []), 'Gate must stay closed without progress');
expect(isSpoilerGateUnlocked(accessible, 'g1', ['u1']), 'Gate should open after all explicit requirements');

const crossWork: ExpansionCatalog = {
  ...accessible,
  works: [
    ...accessible.works,
    { id: 'other', title: 'Otra obra', sourceId: 'editorial' },
  ],
  spoilerGates: [{ id: 'g2', workId: 'other', requiredUnitIds: ['u1'] }],
};
expect(!auditExpansionCatalog(crossWork).valid, 'Cross-work requirements must be rejected');
