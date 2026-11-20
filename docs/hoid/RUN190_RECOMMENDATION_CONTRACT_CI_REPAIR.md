# Run 190 — Recommendation Contract and CI Regression Repair

## Scope

Run 190 repairs integration defects exposed by the first authoritative GitHub Actions run for Run 189. It does not ingest or summarize additional Cosmere material and does not change reader progress, edition manifests, editorial approvals, or production knowledge.

## Findings from Run 189 CI

Two independent defects were present:

1. `src/hoid/recommendations.test.ts` used `describe`, `it`, and `expect` without importing them from Vitest. The repository does not enable Vitest globals, so the source-coverage suite failed at module evaluation with `ReferenceError: describe is not defined`.
2. The cursor-native reading context intentionally represents an open first chapter with `currentChapter: 1` and `completedThroughChapter: null`. The recommendation composer preserved that truthful state, and the conversation gateway parser already validated it, but the shared `HoidRecommendation` union incorrectly allowed only a numeric completed-through watermark. Strict TypeScript therefore rejected the composer and its gateway consumer.

The second issue is a contract mismatch, not a reason to invent chapter zero or claim chapter one has been completed.

## Changes

- Widen `HoidRecommendation.completedThroughChapter` to `number | null` for `resume-current-work` items.
- Document that null is valid only when chapter one is currently open and no numbered chapter has been completed.
- Import `describe`, `expect`, and `it` explicitly from `vitest` in `recommendations.test.ts`.
- Add `readingAwareRecommendations.test.ts` to the source-coverage test command.
- Add `readingAwareRecommendations.ts` and `conversationGateway.ts` to the source-coverage strict TypeScript boundary check.

## Safety invariants

- An open cursor for chapter N is not a completed-through watermark for chapter N.
- For chapter one, the completed-through watermark is null; the UI must not coerce it to zero or one.
- The recommendation gateway accepts a resume item only when its current chapter and completed-through watermark exactly match the authoritative cursor-derived reading context.
- Invalid, ambiguous, or edition-unverified progress continues to fail closed.
- Recommendations remain metadata-only; no narrative order, canon dependency, or unverified chapter segmentation is inferred.
- No private EPUB, XHTML, extracted passage, or copyrighted source text is added to the repository.

## Final validation

Validated on final Run 190 HEAD `3bdd340167c71600d40a4571b31a81efd255f342`:

- 6/6 GitHub Actions workflows completed successfully.
- 889 test executions across the six workflow suites; suites overlap and this is not a count of unique tests.
- Source coverage: 224 tests across 15 files; strict TypeScript passed.
- Cross-book evidence and reading-aware recommendations: 105 tests across 5 files; runtime, recommendation and screen type-check passed.
- Cursor evidence runtime: 98 tests across 5 files; strict TypeScript passed.
- Authorized knowledge graph: 337 tests across 17 files; strict TypeScript passed.
- Reading manifests: 46 tests across 5 files; strict TypeScript passed.
- Edition structure: 79 tests across 5 files; strict TypeScript passed.

Workflow runs:
- https://github.com/Bhoa12/atlas-cosmere/actions/runs/44791412866
- https://github.com/Bhoa12/atlas-cosmere/actions/runs/44791412826
- https://github.com/Bhoa12/atlas-cosmere/actions/runs/44791412887
- https://github.com/Bhoa12/atlas-cosmere/actions/runs/44791412819
- https://github.com/Bhoa12/atlas-cosmere/actions/runs/44791412846
- https://github.com/Bhoa12/atlas-cosmere/actions/runs/44791412817

## Isolation

- Base: `feat/hoid-ia-core-run189`
- Base HEAD: `a5ddf0ee654921863f0d2c07991ad493f1ba9d59`
- Work branch: `feat/hoid-ia-core-run190`
- Final validated code HEAD: `3bdd340167c71600d40a4571b31a81efd255f342`
- The final documentation-only commit follows the validated code HEAD; it does not change source or tests.
- No changes are made directly to `main`, Run 189, or any prior branch.
- No pull request is merged automatically.
