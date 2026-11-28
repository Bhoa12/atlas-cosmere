# Hoid Run 381 — entity relationship application integration

## Objective

Move the existing evidence-bound relationship route behind the provider-neutral conversation application service introduced in Run 378, following the trusted general-conversation and entity-dossier migrations.

## Composition

- HoidScreen retains the UI turn ticket and a short-lived relationship dispatch snapshot.
- createHoidEntityRelationshipApplicationAdapter accepts only the typed relationship route.
- The application service checks the durable progress identity before and after the relationship adapter runs.
- The adapter binds the exact left/right entity identities from route execution to the exact names parsed from the dispatch question.
- The existing HoidEntityRelationshipConversationAdapter remains responsible for resolving both dossiers, requiring the same independently approved claim in both, checking evidence unlocks and citations, applying scope/depth budgets, and producing the minimized display projection.

## Authority and spoiler boundaries

The application adapter is orchestration only. It cannot infer a relationship from co-occurrence, authorize claims, inspect EPUB/XHTML, widen book scope, unlock evidence, truncate dependent claims or choose a provider.

The existing relationship adapter and dossier gateway remain authoritative for:
- exact entity and alias resolution;
- the shared approved-claim requirement;
- source and unlock chapter validation;
- current-progress freshness;
- selected-work and cross-work scope;
- evidence-backed narrative projection;
- explanation-depth budgets;
- indistinguishability of unknown and locked entities.

A relationship route cannot fall through to a general provider. A malformed, incomplete, mismatched or stale dispatch fails closed.

## Data minimization

The application context contains only schema version, turn sequence, route and progress revision/fingerprint. The active dispatch is ephemeral and cleared in a finally block; it is not persisted to message history or SQLite.

No provider configuration, private EPUB bytes, XHTML, source passages, private paths or raw evidence locators are added.

## Validation

The dedicated workflow runs:
- the new relationship application adapter tests;
- existing relationship conversation and claim-projection tests;
- application-service, route-plan and route-execution tests;
- HoidScreen trusted/dossier/relationship integration assertions;
- strict TypeScript compilation including HoidScreen.

All checks must pass on the final branch HEAD before the run is considered validated.
