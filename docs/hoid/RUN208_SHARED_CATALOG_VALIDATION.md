# Run 208 — Shared canonical catalog validation

## Problem

The legacy `catalogValidation.ts` implemented a weaker schema check than
`HoidKnowledgeCatalog`. It only checked non-empty IDs, a non-empty alias,
and a non-negative integer chapter. It did not require a known bibliography
source or a chapter present in that edition's verified reading manifest.
It also used ordinary array filtering and returned caller-owned entry objects.

That created two validation dialects for the same knowledge records. An entry
could pass the legacy helper while being rejected by the catalog, and mutable
or accessor-backed values could reach consumers of `validatedKnowledge()`.

## Change

`catalog.ts` now exports two narrow canonicalization functions:

- `canonicalizeHoidKnowledgeEntry(value)`: validates one untrusted record
  using the catalog's existing descriptor-safe parser, canonical kind
  contract, bibliography check, exact edition-manifest chapter check,
  alias normalization, and metadata size limits.
- `canonicalizeHoidKnowledgeEntries(value)`: validates a complete dense
  collection, enforces the catalog size limit, rejects every member of a
  normalized duplicate-ID group, and returns detached caller-owned copies.

The catalog constructor now uses the collection helper as well. This ensures
the constructor and legacy validation adapter share the same canonicalization
and duplicate-identity rules.

`catalogValidation.ts` is now a compatibility adapter over those exports:

- `isValidKnowledgeEntry()` delegates to the single-entry canonicalizer.
- `validatedKnowledge()` delegates to the collection canonicalizer.

No provider or model is involved in this boundary.

## Failure and downgrade semantics

- An invalid outer collection (including a sparse or accessor-backed array)
  produces an empty result.
- An invalid required field, unknown source, or chapter absent from the
  selected reading manifest rejects that entry.
- Every entry in a normalized duplicate-ID group is rejected.
- Malformed optional evidence metadata is stripped by the canonicalizer.
  This may preserve a name-only entry, but it cannot grant provider-facing
  summary access: the trusted catalog still requires a valid manifest-bound
  evidence locator, an explicit evidence watermark, verified provenance,
  and sufficient reader progress.
- Returned entries are detached copies. Mutating a returned value cannot
  mutate the source object or a later validation result.

## Tests and CI

`catalogValidation.test.ts` now covers manifest-backed chapters, unknown
works, nonexistent and fractional chapters, malformed aliases, exact and
NFKC-equivalent duplicate IDs, Unicode alias collisions, accessor rejection
without getter execution, detached outputs, sparse collections, and the
name-only downgrade for malformed optional evidence.

The catalog evidence-unlock workflow now includes this adapter and its tests
in both path filters, the Vitest command, and strict TypeScript checking.

## Scope

This run changes metadata validation only. It does not ingest EPUB content,
change reading progress, approve editorial claims, activate topic assignments,
or alter provider credentials. Private EPUBs remain local sources; no
copyrighted passages or full-text book content are added to the repository.
