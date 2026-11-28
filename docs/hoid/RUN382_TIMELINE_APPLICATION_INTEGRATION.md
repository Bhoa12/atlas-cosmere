# Hoid Run 382 — progress timeline application integration

## Objective

Move the existing progress-aware entity timeline route behind the provider-neutral conversation application service. The migration follows the trusted general conversation, entity dossier and entity relationship integrations.

## Composition

- HoidScreen retains the UI turn ticket and a short-lived timeline dispatch snapshot.
- `createHoidEntityProgressTimelineApplicationAdapter` accepts only the typed `timeline` route.
- The application service checks the durable progress identity before and after the timeline adapter runs.
- The dispatch binds the exact entity name from route execution to the name parsed from the original question.
- The existing `HoidEntityProgressTimelineAdapter` remains responsible for exact entity resolution, approved evidence, source/unlock chapters, selected-work scope, citation projection and progress freshness.

## Timeline semantics

The timeline adapter groups approved evidence by work in evidence-availability order. Cross-work items remain explicitly unordered. This is not a canonical in-world chronology and the application adapter must not infer dates, causal order or missing events.

The new application boundary does not change those semantics, truncate evidence, authorize claims or widen scope.

## Authority and spoiler boundaries

- The application adapter is orchestration only.
- It rejects non-timeline routes, mutable dispatch snapshots, mismatched entity names and questions whose parsed name differs from the route.
- The existing timeline adapter remains the authority for progress freshness and evidence unlocks.
- A progress change before or after execution discards the complete result.
- Cancellation and superseded turns are mapped to stable unavailable results.
- No general provider fallback is permitted.

## Data minimization

The application context contains only schema version, turn sequence, route and progress revision/fingerprint. The active dispatch is ephemeral and cleared in a `finally` block; it is not persisted to message history or SQLite.

No EPUB bytes, XHTML, source passages, private paths, raw evidence locators or provider payloads are added.

## Validation

The dedicated workflow runs:
- the new timeline application adapter tests;
- existing progress-bound timeline tests;
- application-service, route-execution and route-plan tests;
- HoidScreen timeline wiring assertions;
- strict TypeScript compilation for the new adapter and HoidScreen.

All checks must pass on the final branch HEAD before the run is considered validated.
