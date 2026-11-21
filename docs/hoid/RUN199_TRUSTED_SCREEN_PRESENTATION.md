# Run 199 — trusted screen presentation boundary

## Objective

Connect the signed answer presenter to the actual Hoid screen without provisioning synthetic production trust. The screen must not render provider-selected narrative text directly.

## UI adapter

`createHoidTrustedScreenAnswerPort()` wraps a `HoidTrustedVerifiedAnswerPresenter` and exposes only:

- `present(answerCandidate, explanationDepth)`

It intentionally has no progress argument. The wrapped trusted presenter refreshes the authoritative progress snapshot through its host-owned port on every call.

The adapter then validates the presenter's ready result before allowing the screen to render it:

- canonical bibliography IDs and titles;
- exact claim/evidence/citation correspondence;
- segment-level citation correspondence;
- deterministic narrative reconstruction from unchanged claim segments;
- explanation-depth budgets;
- cross-work provenance for comparative depth.

Blocked presenter text and internal reasons are not forwarded to the UI. Invalid output, presenter errors, missing provenance or exceeded budgets return a neutral withheld message.

## HoidScreen integration

`HoidScreen` accepts an optional `trustedAnswerPort` dependency. Narrative question dispatch is blocked before provider invocation when that dependency is absent. When present, the provider may select candidate claims, but the screen uses only the result reconstructed by the trusted answer port.

`App.tsx` explicitly passes `null` because production trust has not been provisioned. This is intentional: the screen remains closed rather than using test keys, synthetic claims or an unsigned registry.

Progress summaries and catalogue-only recommendations remain available because they describe local reading metadata, not narrative facts.

## Topic recommendations

Topic recommendations currently produce narrative claim text through a separate local answer port. They do not yet pass each resulting claim through the signed screen presenter. Their result button and rendering are therefore explicitly disabled. The selected-interest UI remains visible, but no topic-derived narrative result is shown until a signed topic presentation adapter is implemented.

Do not change `topicRecommendationsTrustReady` to true as a configuration shortcut. Replace the closed gate only after each topic match has been re-presented through the trusted presenter and progress has been refreshed again before the UI commit.

## Security invariants

- No caller/provider cursor is accepted by the screen adapter.
- The trusted presenter refreshes progress itself.
- No raw provider prose is rendered.
- Citations must match the canonical source bibliography.
- Segment text must reproduce the displayed composition exactly.
- Comparative depth requires a segment supported by at least two distinct works.
- No UI is enabled by test fixtures or test signing keys.
- If the trust host is unavailable, narrative output is withheld.
- The existing final progress-scope comparison remains in place before React commits the message.

## Validation

The dedicated workflow runs:
- trusted screen answer adapter tests;
- static integration guards for `HoidScreen` and `App.tsx`;
- trusted host and Ed25519 presentation regressions;
- answer presentation and explanation-depth tests;
- strict TypeScript for the provider-neutral UI adapter.

The PR must remain draft until the final HEAD has successful checks and an independent review.

## Privacy and source policy

This run changes no EPUB, XHTML, source locator, summary, claim or editorial approval. No copyrighted passage or private source path is added. The private Cosmere bibliography remains a source catalogue only; inaccessible passages are not inferred.
