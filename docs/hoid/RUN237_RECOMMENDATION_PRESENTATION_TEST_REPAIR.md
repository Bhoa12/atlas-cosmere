# Run 237 — Repair recommendation presentation contract tests

## Trigger and finding

The final-head workflow for Run 236 completed and exposed two failing assertions in
`editionBoundRecommendationPresentation.test.ts`. The implementation was not
shown to violate its progress-validation contract; both failures came from stale
test expectations:

1. The explained recommendation intentionally exposes the current chapter through
   its edition-bound cursor and Spanish explanation text, rather than copying the
   lower-level `currentChapter` field onto the presentation item.
2. The supposed invalid fixture used revision 1, an empty positions array and a
   canonical timestamp. That is a valid v2 snapshot and correctly produced
   discovery recommendations. The invalid state is revision 0 with a non-null
   timestamp, which violates the ledger's revision-state invariant.

## Changes

- Assert the selected work through its exact edition cursor
  (`bookId=elantris`, `chapterNumber=3`) and the metadata-only explanation.
- Make the invalid fixture genuinely invalid by using revision 0 with a timestamp.
- Add a positive regression test proving that the canonical empty snapshot
  (revision 0, empty positions, null timestamp) remains valid and can recommend
  the first numbered chapter only when its manifest is verified.
- Preserve the strict ledger contract and all production behavior; no validation
  rule was weakened and no progress state is mutated.

## Safety and scope

This patch changes only tests and documentation. It does not alter HoidScreen,
recommendation logic, the signed presenter, the evidence runtime, spoiler
watermarks, production registries, or any EPUB-derived data. No private EPUB,
XHTML, locator, or protected prose is committed.

## Validation

The Run 236 integration workflow had 57 passing tests and 2 failing assertions
across the five selected suites. The strict TypeScript step was skipped because
the preceding test step failed. Run 237 must pass the complete workflow on its
final HEAD before being called validated.


## Additional consistency and TOCTOU hardening

- A regression test compares the adapter's snapshot-derived fingerprint with
  the exact projection fingerprint used by `HoidScreen` for its live view scope.
- Code inspection found that the adapter originally validated the caller's
  `unknown` object once for fingerprinting and then passed that same object to
  the recommender for a second validation. An adversarial Proxy could return
  different valid positions across those reads while keeping the revision
  unchanged, pairing one snapshot's fingerprint with another snapshot's target.
- The adapter now validates and canonicalizes the untrusted input once, then
  passes the resulting immutable ledger snapshot to both fingerprinting and
  recommendation generation.
- A Proxy regression test changes the positions descriptor on a second read
  and asserts that the adapter reads the untrusted object only once and keeps
  the target bound to the first canonicalized cursor.

This is a production-path consistency hardening; it does not change the ledger
rules or grant additional reading access.
