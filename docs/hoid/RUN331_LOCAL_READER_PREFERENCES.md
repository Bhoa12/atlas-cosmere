# Run 331 — local reader preferences for curated recommendations

## Goal

Add reader-controlled personalization without granting narrative authority. Preferences may reorder and limit recommendations that have already passed the signed curated-path display projection. They cannot create a route, make an unstarted work eligible, change chapter dependencies, or relax spoiler rules.

## Contract

`src/hoid/readerRecommendationPreferences.ts` defines a versioned profile with:

- monotonically increasing local revision;
- ordered `priorityWorkIds`;
- `deprioritizedWorkIds`;
- a display limit of 1, 3, or 5 items.

Work identifiers must exist in the metadata-only `HOID_SOURCE_BIBLIOGRAPHY`. Priority and deprioritization sets must be disjoint. Unknown identifiers, malformed arrays, accessor-backed records and invalid revisions fail closed.

The profile fingerprint covers the schema, revision, ordered priority list, deprioritized list and display limit. Reordering a preference or advancing its revision changes the fingerprint.

## Ranking semantics

The ranking function accepts only a ready display projection produced after signed route, evidence, trust-registry and live-progress validation.

1. Explicitly prioritized works appear first in the exact order chosen by the reader.
2. Neutral eligible works retain their original editorial order.
3. Deprioritized works appear after neutral works.
4. The configured display limit truncates presentation only.
5. No item is added, removed for eligibility, rewritten, navigated to, or granted new evidence by preferences.

A withheld source projection remains withheld. Malformed display items, incorrect work-title identities, duplicate keys or a non-editorial rationale authority marker cause the entire preference projection to be withheld.

## Persistence boundary

`HoidReaderRecommendationPreferencesStorePort` defines a provider-neutral local persistence contract:

- `read()` returns the stored untrusted value for validation;
- `compareAndSwap(expectedRevision, next)` must atomically persist a validated next revision or report conflict/unavailability.

The contract is intended for app-owned durable storage such as SQLite. Implementations must not transmit reader preferences to AI providers or remote recommendation services. This run defines the contract and deterministic ranking only; it does not claim that a production persistence adapter or UI editor has been provisioned.

## Spoiler guarantees

The preference layer is downstream of the signed display projection. It receives no chapter references, progress cursors, evidence identifiers, signatures, reviewer identities or EPUB locators. It cannot call the route evaluator or source loader.

A preference for a work that is absent from the safe projection does not cause that work to appear. Preferences therefore influence presentation order, never eligibility.

## Current production status

The curated production path catalogue remains empty. Tests use synthetic display projections and metadata identifiers only. No real reading order, narrative claim, EPUB passage or editorial approval is introduced by this module.
