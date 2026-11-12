import {
  SOURCE_PACKAGES,
  VERIFIED_CATALOGUE_WORKS,
  validateCatalogue,
} from "./sourceCatalogue";

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runSourceCatalogueChecks(): void {
  expect(
    validateCatalogue(SOURCE_PACKAGES, VERIFIED_CATALOGUE_WORKS).length === 0,
    "The shipped catalogue must be valid",
  );

  const duplicate = [
    ...VERIFIED_CATALOGUE_WORKS,
    VERIFIED_CATALOGUE_WORKS[0],
  ];
  expect(
    validateCatalogue(SOURCE_PACKAGES, duplicate).some((error) =>
      error.includes("Duplicate work id"),
    ),
    "Duplicate work identifiers must be rejected",
  );

  const unknownPackage = [{
    id: "synthetic-work",
    title: "Synthetic work",
    sourcePackageId: "missing-package" as any,
  }];
  expect(
    validateCatalogue(SOURCE_PACKAGES, unknownPackage).some((error) =>
      error.includes("Unknown source package"),
    ),
    "Unknown source packages must be rejected",
  );
}
