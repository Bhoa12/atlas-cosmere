# Run 330 — trusted curated-path screen integration

## Objective

Connect the Run 329 safe display projection to the Hoid screen through a branded, provider-neutral host port. The UI must never accept a caller-supplied plan, catalogue, progress snapshot, reviewer signature or evidence package.

## Architecture

- `createHoidTrustedCuratedPathRecommendationScreenPort()` captures one host-owned `loadValidationInput` function.
- The loader must read the current route catalogue, approvals, trust registry, signed evidence packages and authoritative progress on every request.
- The port passes the returned unknown value to `projectHoidCuratedPathRecommendationsForDisplay()`, which revalidates the full plan before producing UI-safe metadata.
- The port does not cache validation context or display results.
- A private WeakSet brand prevents HoidScreen from accepting a structurally compatible fake port.
- Each new request supersedes the previous request. Abort, disposal and stale completions are discarded.
- HoidScreen clears the projection and cancels in-flight work whenever the local progress revision/fingerprint changes.
- HoidTrustedScreenHost exposes an optional host-owned port. Ownership remains with the caller; the screen does not dispose it.

## UI contract

HoidScreen displays only:

- path title;
- work title;
- signed editorial rationale;
- a statement that selection remains manual.

It does not display chapter targets, locators, progress cursors, fingerprints, reviewer identities, signatures or evidence identifiers. It never opens a book or changes progress from a route recommendation.

When no branded port is configured, the route panel remains disabled and explicitly states that no reviewed itinerary is connected. Bibliography order is never used as a fallback.

## Trust boundary

The host must pin the route-review root key out of band and provide a loader backed by the current trust registry and durable progress source. The port brand is a composition guard, not a substitute for the pinned root key, monotonic trust-registry revision storage or the signed catalogue/evidence validators.

No provider is called. The UI cannot submit a progress snapshot or route plan to the port. The full signed context is loaded locally by the host and revalidated before display.

## Production status and limitations

- The production curated-path catalogue remains empty.
- The current App entry point does not configure a trusted curated-path port; the new panel therefore remains disabled until native trust provisioning and real, independently reviewed routes exist.
- No actual Cosmere reading order is asserted.
- No private EPUB/XHTML, passage, locator, new narrative summary or production claim is committed.
- Tests use synthetic invalid/hostile loader results and do not constitute real editorial approvals.

## Validation

The dedicated workflow runs the screen-port regressions, the existing signed curated-path/display suite and strict TypeScript checks for the screen and host integration.
