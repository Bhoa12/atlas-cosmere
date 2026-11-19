# Run 167 — Editorial approval-count regression

## Finding

Run 166's final HEAD `6eff05be17c678ec47a2549d4ff38dc98903f4a9` completed 16 pull-request workflow runs: 12 succeeded and 4 failed.

The four failed workflows all stopped in the same shared test file, `src/hoid/editorialReviewBundle.test.ts`. They were not four independent production defects:

- Hoid editorial bundle promotion authority;
- Hoid complete editorial review bundle;
- Hoid signed editorial bundle promotion;
- Hoid atomic editorial claim validation.

Two assertions still expected `approvedCount: 45`, although the complete review manifest contains 53 packets. The actual receipt validator correctly reported 51 approvals in both scenarios.

## Correct accounting

The full staging manifest contains 53 review packets. In the two affected cases:

1. One unresolved identity and one additional summary receipt require revision: 53 - 2 = 51 approved.
2. One receipt requires revision and one relationship receipt is missing: 53 - 1 - 1 = 51 approved.

The production gate remains closed in both cases.

## Change in Run 167

The tests now derive the expected approval count from `manifest.packets.length`, subtracting revision-required, rejected and missing receipts. This avoids duplicating a stale absolute count when the staging inventory grows.

No production validator, authorization rule, source allowlist, editorial draft, reading progress or activation receipt was changed.

## Safety and source boundaries

- The full 53-record bundle remains staging-only.
- All summaries and dossiers remain pending independent review.
- No production knowledge is approved or written.
- No EPUB, XHTML, extracted prose, private URI or protected passage is committed.
- This repair uses repository test fixtures only; it does not claim to inspect any private book passage.

## Validation

Run 167 must pass the four affected workflows, the complete editorial review suite, signed promotion regressions and strict TypeScript before the PR can be considered mergeable. Keep the PR in draft and do not merge automatically.
