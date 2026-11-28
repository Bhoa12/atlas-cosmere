# Hoid Run 380 — entity dossier application integration

## Objective

Move the existing entity-dossier route behind the provider-neutral conversation application service introduced in Run 378, following the trusted general-conversation migration in Run 379.

## Composition

- `HoidScreen` retains the current UI turn ticket and a short-lived dossier dispatch snapshot.
- `createHoidEntityDossierApplicationAdapter` accepts only the typed `dossier` route and delegates to the existing local `HoidEntityDossierConversationAdapter`.
- The application service reads the current progress identity before and after the dossier adapter executes.
- The dossier adapter continues to classify the exact entity question, validate the canonical book scope, refresh durable progress around dossier projection, enforce evidence unlocks and explanation-depth budgets, and return only the minimized display projection.
- The screen keeps its existing mapping of ready, not-found, needs-name and unavailable outcomes into user-facing messages.

## Authority and spoiler boundaries

The application adapter is orchestration only. It cannot resolve entities, authorize claims, inspect EPUB/XHTML, widen book scope, unlock evidence, truncate dependent claims or choose a provider.

The existing dossier adapter and gateway remain authoritative for:
- exact alias/entity resolution;
- source and unlock chapter validation;
- current-progress freshness;
- selected-work scope;
- evidence-backed narrative projection;
- explanation-depth budgets;
- indistinguishability of unknown and locked entities.

The application service adds turn sequencing, cancellation and a second progress-identity check at the application boundary. A result is discarded if the UI turn is superseded or the reading progress changes.

## Data minimization

The application context contains only schema version, turn sequence, route and progress revision/fingerprint. The active dispatch is ephemeral and is cleared in `finally`; it is not persisted to message history or SQLite.

No provider configuration, private EPUB bytes, XHTML, source passages, private paths or raw evidence locators are added.

## Validation

The dedicated workflow runs:
- the new dossier application adapter tests;
- existing dossier conversation tests;
- application-service, route-plan and route-execution tests;
- HoidScreen trusted/dossier integration assertions;
- strict TypeScript compilation including `HoidScreen.tsx`.

All checks must pass on the final branch HEAD before the run is considered validated.