# Hoid Run 379 — trusted conversation application integration

## Objective

Move the first real narrative route through the provider-neutral application service introduced in Run 378. The first migration target is the general exact-unit conversation route; specialized dossier, relationship, timeline, evolution and magic routes remain on their existing adapters until separately migrated.

## Composition

- `HoidScreen` continues to own the current UI turn ticket and a short-lived dispatch snapshot.
- `createHoidTrustedConversationApplicationAdapter` binds the already-branded trusted screen port to the application service.
- The application service resolves the typed route, reads the current progress identity before dispatch, verifies turn ownership and cancellation, and reads progress again before returning.
- The adapter dispatches only `route === "conversation"` and forwards the canonical book scope, classified intent and selected explanation depth to the trusted screen port.
- The trusted screen port remains responsible for signed exact-unit composition, evidence provenance, claim authorization and its own display projection.
- `HoidScreen` retains its existing final progress comparison and UI-safe message projection as defense in depth.

## Freshness and spoiler behavior

The application adapter receives only a progress revision/fingerprint reader. It does not receive chapter text, EPUB paths, evidence payloads or provider configuration. If progress is stale before dispatch, changes while the trusted gateway runs, or the UI turn is superseded/cancelled, the application service returns an abstention and the screen discards any result.

The route scope is re-resolved by the application service from the same immutable classifier input used by the screen. The trusted port still validates its own scope and presentation permit. The application service does not widen scope, authorize evidence or unlock a claim.

## Provider and trust boundaries

- No model/provider is selected or instantiated here.
- Only the existing branded `HoidTrustedConversationScreenPort` is used.
- The adapter rejects non-conversation routes and stale UI dispatch snapshots.
- Raw host results are returned only to the existing screen branch, which maps the typed trusted result to its already-minimized text/citations/segments.
- The generic application service remains presentation-agnostic.

## Scope of migration

Only the general conversation route is migrated in this run. Other route families are intentionally unchanged to avoid a broad rewrite of their route-specific investigation/session state. They can be moved one at a time using the same application boundary.

## Validation

The dedicated tests cover typed dispatch, current-turn ownership, progress changes after dispatch, rejection of non-conversation routes and cancellation. The integration regression asserts that HoidScreen delegates the general conversation route through the application adapter rather than calling the trusted screen port directly.

No private EPUB/XHTML bytes, chapter text, local paths or provider payloads are added. Tests use synthetic progress and synthetic trusted-port results.
