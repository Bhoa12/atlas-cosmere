import { createCatalogBoundSpoilerPolicy } from "./catalogPolicy";
import { HOID_SOURCE_CATALOG } from "./sourceCatalog";

/**
 * Dependency-free boundary checks for catalog-bound authorization.
 * Synthetic knowledge is used deliberately; no private narrative text is
 * embedded in the test.
 */
export function assertCatalogBoundSpoilerPolicy(): void {
  const policy = createCatalogBoundSpoilerPolicy(
    {
      "mistborn-era1-final-empire": 4,
      "unknown-work": 999,
    },
    HOID_SOURCE_CATALOG,
  );

  const knownItem = {
    id: "synthetic-known",
    aliases: [],
    kind: "concept" as const,
    unlock: { bookId: "mistborn-era1-final-empire", chapter: 4 },
  };
  const unknownItem = {
    id: "synthetic-unknown",
    aliases: [],
    kind: "concept" as const,
    unlock: { bookId: "unknown-work", chapter: 1 },
  };

  if (!policy.allows(knownItem)) {
    throw new Error("Known catalog progress should authorize matching knowledge");
  }
  if (policy.allows(unknownItem)) {
    throw new Error("Unknown catalog progress must not authorize knowledge");
  }
}
