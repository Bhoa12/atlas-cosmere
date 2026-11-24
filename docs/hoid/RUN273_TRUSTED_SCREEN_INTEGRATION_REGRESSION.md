# Run 273 — trusted screen integration regression

## Finding

Run 272 correctly moved thematic recommendation freshness and presenter identity out of React state into the component-local `topicRecommendationBindingRef`. The existing `trustedScreenIntegration.test.ts` still asserted the previous implementation, which stored the presenter port in state through `setTopicRecommendationTrustPort()`.

The Run 272 CI failure was therefore a stale source-wiring assertion, not a runtime or TypeScript failure:

- 86 of 87 tests in the trusted-screen workflow passed.
- The single failure expected the removed state setter and state variable.
- The dedicated Run 272 recommendation display projection workflow passed both Vitest and strict TypeScript.
- The remaining Run 272 workflows completed successfully.

## Change

Update the integration regression to assert the current security boundary:

- the signed topic presenter is still required before thematic recommendations can be produced;
- the recommendation view state stores only `HoidTopicRecommendationDisplayItem[]`;
- the revision, progress fingerprint, topic-selection key and presenter capability are written to the private ref;
- the current render checks the private binding against the current progress scope, selected topics and trusted answer port;
- the minimized projection, not the privileged presenter output, is committed to React state;
- legacy state-based trust bindings are absent.

No production behavior is changed in this run.

## Validation

The updated test is covered by the existing `hoid-trusted-screen-presentation` workflow. Run 273 is not certified until the final branch HEAD has completed all triggered checks successfully.

## Privacy and spoiler safety

This is a source-wiring regression using only synthetic test data. It does not read EPUBs, import XHTML, add narrative claims, change progress, or modify spoiler thresholds.

## Isolation

- Base: `feat/hoid-ia-core-run272` at `7871dfcbdee1eaed9ef5c5290b53ea23c2122b8f`.
- Branch: `feat/hoid-ia-core-run273`.
- Run 272 PR #165 remains open and unchanged.
- No writes to `main`; no previous branch or PR is retargeted or modified.
