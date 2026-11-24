# Run 270 — CI type-contract repair for cooperative recommendation cancellation

## Objective

Repair the strict TypeScript failures discovered by the first GitHub Actions run for Run 269 without weakening compiler settings or changing the cancellation contract.

## Verified CI findings on Run 269

The focused Vitest suites passed (51/51). The strict type-check then exposed two integration/fixture errors:

- `src/screens/HoidScreen.tsx`: TS7006 on the `signal` parameter of the `refreshCurrentProgress` callback supplied to the topic-interest recommendation gateway. The callback is now explicitly typed as `(signal?: AbortSignal)`, matching the gateway contract. The trusted presenter callback keeps the same explicit annotation for consistency.
- `src/hoid/trustedTopicRecommendations.test.ts`: TS2322 because the async mock's inferred return type was narrower than the deliberate `Promise<unknown>` used by the pending-load cancellation test. The fixture now declares `() : Promise<unknown>` explicitly.

No `any`, type assertion, skipped check, or relaxed compiler option was introduced.

## Scope

- The production change is a type annotation only; runtime cancellation behavior is unchanged.
- The test change makes the fixture's declared return type match the port's intentionally untrusted `unknown` boundary.
- Existing abort propagation, late-result observation, progress freshness checks, signed presentation and no-partial-results behavior remain unchanged.

## Validation

The Run 269 CI log showed all five focused Vitest suites passing (51 tests) before TypeScript failed. The two reported compiler errors have been corrected in this branch. The new branch's GitHub Actions results are authoritative; no validation is claimed until they complete.

## Privacy and spoiler safety

No private EPUB, XHTML, chapter text, locator, file handle or reading-progress data is included. Tests remain synthetic. No SQLite ledger or editorial authorization is changed.

## Isolation

- Base: `feat/hoid-ia-core-run269`.
- Branch: `feat/hoid-ia-core-run270`.
- This repair branch is separate from `main` and all prior feature branches.
- No PR is merged or retargeted by this change.
