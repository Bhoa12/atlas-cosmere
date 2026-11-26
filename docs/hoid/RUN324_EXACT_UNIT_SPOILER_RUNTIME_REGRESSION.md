# Run 324 — exact-unit spoiler runtime regression repair

## Scope

Run 323 introduced exact-unit spoiler dependencies into the signed-claim runtime and moved the check before provider selection. The first CI pass exposed stale assertions in the legacy v2 runtime test suite. This run repairs those expectations and adds a direct cross-work provider-egress regression.

Base: `feat/hoid-ia-core-run323` at `c3600ad7f604ccfbe2f8efce6adc5a5483f64bb6`.

## CI findings from Run 323

The failed workflow logs consistently pointed to two assertions in `src/hoid/exactUnitEvidenceRuntime.test.ts`:

1. The v2 request fingerprint test still calculated the pre-Run-323 payload. The runtime now commits the eligible claim's exact-unit dependency fingerprint into the opaque request digest. The provider request intentionally does not expose chapter references, unit IDs, navigation hashes or progress thresholds.
2. A cited-chapter test expected `no-authorized-claims`. With the new earlier dependency gate, the correct and more specific result is `spoiler-dependency-locked`; the selector must remain uncalled.

These were test-contract mismatches caused by the intended security change, not evidence that the spoiler gate should be weakened.

## Changes

- Rename the v2 fingerprint test to describe the exact-unit dependency binding.
- Rebuild the expected digest using `buildHoidExactUnitSpoilerDependencySet`, including the opaque dependency fingerprint.
- Assert that serialized provider egress contains none of `chapterNumber`, `unitId`, `completedThroughChapter` or `navigationSha256`.
- Update the cited-chapter regression to expect `spoiler-dependency-locked` and retain the assertion that the selector is not invoked.
- Add a synthetic integration test with prerequisites in three works. Two works have sufficient progress while the third is absent; the runtime must return `spoiler-dependency-locked` before calling the selector.

## Security properties

- All exact source, first-safe-appearance and unlock references remain local to Hoid.
- Only eligible candidate IDs, bounded claim summaries and an opaque request fingerprint cross the provider boundary.
- The dependency fingerprint is committed to the request digest but its constituent references and progress are not exported.
- Missing progress for any required work fails closed.
- No reading progress is mutated.
- No EPUB, XHTML, source passage or private path is read or committed.
- No production knowledge is promoted or written.
- No reviewer keys, trust roots or approvals are provisioned.

## Validation

The dedicated workflow runs the exact-unit dependency gate, exact-unit answer runtime, claim-integrity and trusted-host regression tests, followed by strict TypeScript checks. Other PR workflows are also expected to run against this branch; final status is reported from the actual GitHub Actions results, not inferred from the workflow definition.
