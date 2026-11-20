# Run 188 — Hardened invocation context and reusable adapter conformance

## Summary

Run 188 hardens the provider invocation boundary and adds a reusable behavioral suite for provider-specific selector adapters. The work is isolated on `feat/hoid-ia-core-run188`, based on Run 187 commit `a45f7e1f5a328234a0517374a73a9d1d46f7af5c`.

## Invocation-context hardening

`inspectHoidProviderInvocationContext()` now accepts only a frozen, plain, closed record with one enumerable data property: `signal`.

- Accessor-backed contexts are rejected without evaluating the getter.
- Mutable contexts and contexts with extra keys are rejected before transport dispatch.
- The signal must pass the native same-realm `AbortSignal.prototype.aborted` brand getter.
- The adapter snapshots the validated signal once and forwards it in a new frozen transport context.
- A pre-aborted signal is rejected before the transport starts.

The check is intentionally same-realm because the runtime creates the signal and invokes its adapter in the same JavaScript runtime. A provider transport must not substitute a signal-like object.

## Closed request validation

The adapter additionally rejects:
- intents outside `explain`, `recommend`, and `context`;
- candidate text with leading/trailing whitespace or control characters;
- comparative budgets that require cross-work evidence while declaring fewer than two minimum works.

These checks complement the existing exact-key, frozen snapshot, candidate-ID, evidence-ID and hard-budget validation.

## Reusable conformance suite

`src/hoid/providerAdapterConformance.testkit.ts` exports `defineHoidProviderAdapterConformanceSuite()`. Any provider-specific adapter factory can reuse the suite to verify:
- exact immutable request and signal forwarding;
- rejection of mutable snapshots before dispatch;
- accessor-context rejection without getter execution;
- rejection of pre-aborted signals;
- propagation of active cancellation;
- at-most-one transport dispatch per invocation;
- no automatic retry after an unclassified transport failure;
- stable request fingerprints across explicit repeated invocations of the same snapshot.

The reference adapter tests invoke this suite. The provider adapter workflow type-checks the test kit as well.

## Retry and idempotency policy

The core performs no automatic retries. A transport failure does not prove that a remote provider did not process a request. An adapter that later adds retries must document the provider's idempotency semantics, reuse the exact immutable request and original deadline/signal, and never retry after cancellation, timeout or a response has been received.

The SHA-256 request fingerprint remains a freshness/correlation value. It is not provider authentication, a remote idempotency guarantee, or an authorization token.

## Validation status

GitHub Actions for the Run 188 HEAD are the source of truth. This report does not claim success before the workflows finish. The provider conformance workflow now includes the reusable test kit in its strict TypeScript check.

## Editorial and source integrity

No EPUB, XHTML, source passage, image or protected book text was inspected or uploaded in this run. No chapter summaries, claims, reading positions, source manifests or production knowledge were changed. The known editorial inventory remains unchanged and unapproved knowledge remains unavailable to production.

## Isolation

- Base branch: `feat/hoid-ia-core-run187`
- Base SHA: `a45f7e1f5a328234a0517374a73a9d1d46f7af5c`
- Working branch: `feat/hoid-ia-core-run188`
- `main` and all earlier Run branches are out of scope and must remain untouched.
- No merge is performed by this run.
