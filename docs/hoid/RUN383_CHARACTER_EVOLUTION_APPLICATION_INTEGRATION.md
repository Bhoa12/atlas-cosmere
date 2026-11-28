# Hoid Run 383 — character evolution application integration

## Objective

Move the existing progress-bound character-evolution route behind the provider-neutral conversation application service. This extends the same application boundary already used by trusted general conversation, entity dossiers, relationships and entity progress timelines.

## Composition

- HoidScreen retains the UI turn ticket and a short-lived evolution dispatch snapshot.
- `createHoidCharacterEvolutionApplicationAdapter` accepts only a ready `character-evolution` route.
- The application service validates the durable progress revision/fingerprint before dispatch and after the handler returns.
- The dispatch binds the exact character name and optional editorial dimension parsed from the original question to the typed route.
- The existing `HoidCharacterEvolutionExplanationAdapter` remains responsible for dossier resolution, reviewed claim/annotation digests, source and unlock chapters, selected-work scope, citations, explanation budgets and progress freshness.

## Editorial and chronology semantics

The evolution adapter groups independently reviewed claims by editorial dimension and evidence availability. It does not infer a personality change, causal relationship, missing transition or in-world chronology from chapter order.

The application adapter preserves those semantics and never promotes annotations or supplies narrative facts. Production `HOID_CHARACTER_EVOLUTION_ANNOTATIONS` remains empty until original editorial annotations are separately reviewed and promoted by the trusted host.

## Authority and spoiler boundaries

- The application adapter is orchestration only; it is not an evidence authority.
- It rejects non-evolution routes, incomplete intents, mutable dispatch snapshots, mismatched character names and mismatched dimensions.
- The existing evolution adapter remains authoritative for approved dossier claims, review digests, source/unlock chapters, scope, citations and budgets.
- The application service checks progress before and after the handler. A changed revision or fingerprint discards the complete result.
- Cancellation and superseded turns map to stable unavailable results.
- There is no generic-provider fallback and no provider selection in this adapter.

## Data minimization

The application context contains only schema version, turn sequence, route and progress revision/fingerprint. The active dispatch is ephemeral and cleared in a `finally` block; it is not persisted to message history or SQLite.

No EPUB bytes, XHTML, source passages, private paths, raw evidence locators or provider payloads are added.

## Validation

The dedicated workflow runs:
- the new evolution application adapter tests;
- existing character-evolution intent, evidence, unlock, citation and budget tests;
- application-service, route-execution and route-plan tests;
- HoidScreen trusted-wiring assertions;
- strict TypeScript compilation for the adapter, existing evolution engine and HoidScreen.

All checks must pass on the final branch HEAD before the run is considered validated.
