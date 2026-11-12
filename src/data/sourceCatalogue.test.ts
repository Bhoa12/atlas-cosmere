import { validateSourceCatalogue, VERIFIED_SOURCE_CATALOGUE, SourceCatalogueEntry } from './sourceCatalogue';

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

export function runSourceCatalogueBoundaryChecks(): void {
  expect(validateSourceCatalogue(VERIFIED_SOURCE_CATALOGUE).valid, 'verified catalogue should validate');

  const duplicate: SourceCatalogueEntry[] = [
    { id: 'work-a', title: 'A', sourceBundle: 'cosmere.epub', kind: 'novel' },
    { id: 'work-a', title: 'B', sourceBundle: 'cosmere.epub', kind: 'novel' },
  ];
  expect(!validateSourceCatalogue(duplicate).valid, 'duplicate ids must fail closed');

  const malformed: SourceCatalogueEntry[] = [
    { id: 'Work A', title: 'A', sourceBundle: 'cosmere.epub', kind: 'novel' },
  ];
  expect(!validateSourceCatalogue(malformed).valid, 'non-canonical ids must fail closed');
}
