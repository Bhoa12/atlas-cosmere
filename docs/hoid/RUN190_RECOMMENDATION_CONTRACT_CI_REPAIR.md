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

## Validation status

The initial Run 189 CI logs showed the two defects above. Run 190 adds the fixes and broadens the source-coverage test/type-check boundary so both recommendation composition and gateway parsing are checked together.

This document does not claim that Run 190 is validated. GitHub Actions for the final Run 190 HEAD must complete successfully before the branch is considered CI-green.

## Isolation

- Base: `feat/hoid-ia-core-run189`
- Base HEAD: `a5ddf0ee654921863f0d2c07991ad493f1ba9d59`
- Work branch: `feat/hoid-ia-core-run190`
- No changes are made directly to `main`, Run 189, or any prior branch.
- No pull request is merged automatically.
