# Run 206 — shared first-safe-appearance completion policy

## Finding

Run 205 corrected the cross-world comparison presenter to compare an entity's
first-safe chapter against the inclusive completed-through watermark. The
catalog used the same N-1 semantics indirectly through its legacy reading
projection, but expressed the rule independently. Two implementations of the
same security invariant can drift in a later change.

## Changes

- Add `isHoidFirstSafeAppearanceCompleted()` to the provider-neutral reading
  boundary module.
- Validate the first-safe chapter as an integer in the supported chapter range.
- Accept explicit whole-work completion only as the boolean `true`.
- Otherwise require an integer completed-through chapter and compare it
  inclusively with the first-safe chapter.
- Use the shared policy in `HoidKnowledgeCatalog.isEntityMentionUnlocked()`.
- Use the same policy in the trusted cross-world comparison presenter.
- Add regression tests covering the open first-safe chapter, the next cursor,
  explicit completion, chapter one, malformed markers and malformed progress.
- Extend the trusted-comparison workflow path filters and test/type-check
  coverage. The knowledge-graph workflow already exercises the catalog,
  reading-boundary tests and their strict TypeScript dependency graph.

## Security invariant

For a cursor currently open at chapter N, the validated completed-through
watermark is N-1. A first-safe appearance at chapter N is not disclosed until
the reader advances beyond N or explicitly completes the work.

The helper receives only a completed-through value. Callers must not pass the
open cursor chapter as though it were completed. Missing, malformed,
non-integer, negative or out-of-range values fail closed.

Entity-name disclosure and full-summary evidence unlock remain separate
checks. The knowledge graph continues to require both the catalog's
first-safe-appearance check and the independent evidence-unlock watermark.

## Validation scope

- Shared helper unit tests and catalog integration tests run in the reading
  boundary suite.
- Trusted cross-world comparison tests continue to cover the first-safe
  chapter while open and after completion.
- The knowledge-graph workflow runs the reading-boundary suite and strict
  TypeScript checks for the graph's imported catalog dependencies.
- The trusted-comparison workflow runs its own tests and strict TypeScript
  check against the shared helper and catalog dependency.

CI results must be reported only for the final branch HEAD.

## Production status and privacy

This is an authorization-policy consolidation, not a narrative ingestion run.
It does not add or approve Cosmere facts, topic assignments, reviewer
credentials, trust keys or activation receipts. It does not modify reading
progress, edition manifests or spoiler thresholds.

The private EPUBs remain a source catalog only. No EPUB/XHTML body, extracted
passage, private source path or copyrighted narrative text is committed.
