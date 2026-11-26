# Run 330 — trusted curated-path screen integration

## Objective

Connect the Run 329 safe display projection to HoidScreen through a provider-neutral, host-owned capability. The UI must never accept a caller-supplied plan, catalogue, progress snapshot, reviewer signature or evidence package.

## Architecture

- `createHoidTrustedCuratedPathRecommendationScreenPort()` captures a host-owned route-material loader.
- The port separately requires a pinned `HoidTrustedHostBootstrapPort`, a durable `HoidTrustRegistryRevisionStorePort`, an exact repository identity and a host clock.
- On every presentation it loads and validates the pinned host configuration, verifies the durable minimum reviewer-registry revision, then loads current route material.
- The route-material loader may provide only the plan, catalogue, progress snapshot, route attestations, reviewer registry, Ed25519 verifier, signed evidence packages and evidence context. It cannot provide the repository, root key, clock or minimum registry revision.
- The port derives the repository and root key from the pinned host configuration and derives the revision floor from both the pinned minimum and durable anti-rollback store.
- The evidence context must be scoped to the same repository.
- The completed context is passed as unknown to `projectHoidCuratedPathRecommendationsForDisplay()`, which revalidates the route quorum, exact-unit signed claims, source/first-safe-appearance/unlock policies and current progress.
- No validation result is cached. Every screen request performs a fresh host read and full projection.
- A private WeakSet brand prevents HoidScreen from accepting a structurally compatible fake port.
- New requests supersede old ones; abort, disposal and stale completions are discarded.
- HoidScreen clears displayed route data and cancels in-flight work whenever its local progress revision/fingerprint changes.
- HoidTrustedScreenHost exposes an optional host-owned port. The caller retains ownership and must dispose it with its native session.

## UI contract

HoidScreen displays only:

- path title;
- work title;
- signed editorial rationale;
- a statement that selection remains manual.

It does not display chapter targets, locators, progress cursors, fingerprints, reviewer identities, signatures or evidence identifiers. It never opens a book or changes progress from a route recommendation.

When no branded port is configured, the route panel remains disabled and explicitly states that no reviewed itinerary is connected. Bibliography order is never used as a fallback.

## Trust boundary

The native host must provision `readPinnedConfiguration` from secure out-of-band storage and provide a durable revision store with anti-rollback semantics. The host clock is used for bootstrap expiry and signature validity.

The private port brand is a composition guard, not a substitute for the pinned root key, durable revision storage, signed route attestations or signed exact-unit evidence. The host must also supply a trusted Ed25519 verifier. All those dependencies are revalidated or re-read at presentation time.

No provider is called. The UI cannot submit a progress snapshot or route plan to the port. The full signed context is loaded locally by the host and revalidated before display.

## Production status and limitations

- The production curated-path catalogue remains empty.
- The current App entry point does not provision this optional port; the new panel therefore remains disabled until native trust provisioning and real, independently reviewed routes exist.
- No actual Cosmere reading order is asserted.
- No private EPUB/XHTML, passage, locator, new narrative summary or production claim is committed.
- Tests use synthetic trust configurations, revision stores and invalid route material. They do not constitute real editorial approvals.

## Validation

The dedicated workflow runs the trusted screen-port regressions, the existing signed curated-path/display suite and strict TypeScript checks for the port, HoidScreen and HoidTrustedScreenHost.
