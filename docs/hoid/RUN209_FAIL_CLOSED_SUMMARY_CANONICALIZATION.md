# Run 209 — Fail-closed summary canonicalization

## Finding

The shared canonicalizer correctly removed an invalid optional evidence tuple,
but it still retained the entry's `summary` and `provenance` fields. The
`HoidKnowledgeCatalog` later refused to expose that summary because
`entriesForContext()` requires a valid source, unlock watermark and verified
provenance. However, the compatibility adapter `validatedKnowledge()`
returned the canonical entry itself. A downstream consumer that read
`summary` directly could therefore mistake a downgraded name-only record for
usable narrative context.

The metadata was not authorized by the catalog, but the compatibility value
still carried narrative text. That contradicted the documented name-only
downgrade and made safety depend on every consumer remembering to re-check the
catalog.

## Change

The canonicalizer in `src/hoid/catalog.ts` now retains a summary only when all
of the following are true:

1. The edition-bound `evidenceSource` survives exact manifest/locator
   validation.
2. The `evidenceUnlock` survives validation in the same work and does not
   precede the source chapter.
3. The provenance value is recognized.
4. The provenance is exactly `verified`.
5. The summary is a bounded, non-empty, control-character-free original
   editorial summary.

The provenance field itself is retained only when both evidence records form a
complete valid scope. If source or unlock metadata is absent, malformed,
inconsistent, or not edition-bound, the canonical entry is genuinely
name-only: `summary` and `provenance` are omitted.

A valid evidence scope with `limited` or `unavailable` provenance may retain
that status for editorial diagnostics, but never retains summary text.
The catalog's existing `entriesForContext()` check remains an independent
authorization boundary.

## Tests

Added `src/hoid/catalogSummaryBoundary.test.ts` with seven cases:

- Preserve a verified summary only with a complete valid source/unlock tuple.
- Strip summary and provenance when the source locator is invalid.
- Strip summary and provenance when the unlock watermark is absent.
- Strip summary and provenance when the unlock precedes its source.
- Do not retain summary text for limited provenance.
- Reject summary text when provenance is absent or unrecognized.
- Preserve safe name matching while making the entry genuinely name-only.

Updated `catalogValidation.test.ts` so its malformed-evidence downgrade
assertion checks that summary and provenance are absent.

## CI

The catalog evidence-unlock workflow now includes the new test file in both
push and pull-request path filters, the Vitest command, and the strict
TypeScript command.

## Scope and privacy

This is a metadata authorization correction. It does not ingest or inspect
additional EPUB passages, alter reading progress, change edition manifests,
approve claims, activate topic assignments, or provision trust credentials.
Private EPUBs remain local sources. No copyrighted passages, XHTML bodies,
images, or full-text book content are committed.

## Expected invariant

A canonical entry without a complete, edition-bound, explicitly verified
evidence scope may identify an entity, but it cannot carry narrative summary
text through either the catalog API or the legacy validation adapter.
