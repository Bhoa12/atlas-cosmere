# Run 228 — Trusted screen capability provenance

## Purpose

The screen-facing answer port previously accepted any object with a compatible
`present(answer)` method. The inner production presenter already performed
root-pinned bootstrap, durable trust-revision and reviewer-signature checks,
but the UI adapter did not verify that its presenter was the exact instance
created by that verified builder.

Likewise, `HoidScreen` accepted a structurally compatible port prop. The app
currently injects `null`, which correctly blocks narrative presentation, but
the boundary should remain safe if a future host attempts to provision it.

## Changes

### Verified presenter provenance

`trustedVerifiedAnswerPresentation.ts` now registers a presenter in a
module-private `WeakSet` only after all of the following have succeeded:

- canonical approved-claim validation;
- host-pinned bootstrap validation;
- durable monotonic trust-revision verification and persistence;
- root-signed reviewer registry validation;
- Ed25519 reviewer signature verification;
- construction of the evidence-backed presenter.

`isHoidTrustedVerifiedAnswerPresenter()` checks exact object identity. A
copied object, proxy, or caller-created object with the same method is not
accepted.

### Screen-port provenance

`createHoidTrustedScreenAnswerPort()` now accepts only an exact presenter
registered by the verified builder. It registers the resulting immutable
port in a second module-private `WeakSet`.

`isHoidTrustedScreenAnswerPort()` exposes a read-only identity check. It does
not provide a way to register or mint a capability.

### HoidScreen boundary

`HoidScreen` normalizes the incoming prop through
`isHoidTrustedScreenAnswerPort()`. An unregistered object is treated exactly
like an absent port, so the narrative branch remains blocked. Reading-progress
and metadata-only catalogue recommendations remain available through their
existing cursor-validated routes.

The current `App.tsx` continues to pass `trustedAnswerPort={null}`. No
production bootstrap, reviewer registry, signed editorial claim bundle or
durable revision witness is provisioned by this run.

## Narrative and spoiler invariants

- The gateway still selects only claim IDs from the local evidence runtime.
- The verified presenter reconstructs prose from approved original claims;
  provider-authored prose is never rendered.
- Each displayed citation remains bound to the canonical bibliography,
  chapter number and edition locator.
- Segment text must exactly match the composition of its claim segments.
- The trusted presenter reads progress from the host-owned port; the screen
  cannot supply a cursor to the presenter.
- Progress revision/fingerprint checks and stale-message pruning are unchanged.
- An untrusted or absent port causes abstention, not a provider fallback.

## Verification

Tests use synthetic metadata, deterministic test-only Ed25519 keys and an
in-memory revision witness. They verify positive construction through the
real signed-presenter builder, rejection of structural fakes/proxies/copied
objects, screen-port identity, revision invalidation and chapter-unlock
enforcement.

These fixtures are not production trust material. No private EPUB bytes,
XHTML, passages, images or unverified narrative summaries are committed.

## Security boundary and limitations

A module-private `WeakSet` provides process-local capability provenance. It
prevents accidental structural substitution and ordinary caller-created
objects from impersonating the verified presenter/port. It is not a sandbox
against arbitrary code execution, module instrumentation or a compromised
application bundle.

Production activation still requires an out-of-band root bootstrap, a
durable rollback-resistant revision witness, reviewed signed editorial
bundles, native cryptographic providers and device-level conformance tests.
Conversation persistence remains inactive.
