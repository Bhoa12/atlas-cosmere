# Run 332 — SQLite persistence for reader preferences

## Objective

Implement the Run 331 provider-neutral preference store contract using the
existing process-wide Expo SQLite database. Preferences remain device-local and
are never sent to an AI provider or remote recommendation service.

## Components

- `sqliteReaderRecommendationPreferencesStore.ts`: structural SQLite adapter.
- `expoReaderRecommendationPreferencesStore.ts`: native composition using
  `getExpoHoidDatabase()`.
- `sqliteReaderRecommendationPreferencesStore.test.ts`: transactional fake
  adapter tests.
- The adapter reuses `HoidSqliteDatabasePort` from the progress storage
  boundary and the existing shared `atlas-cosmere-hoid.db` handle.

## Storage schema

Table: `hoid_reader_recommendation_preferences_v1`

The table contains one device-local reader profile:

- `id = 1`: single-reader installation scope;
- `schema_version = 1`;
- `revision`: monotonically increasing safe integer;
- `payload`: canonical JSON containing only work IDs, ordering lists and the
  display limit.

No chapter numbers, progress cursors, chapter titles, EPUB paths, evidence
IDs, signatures, rationales, conversation text or provider payloads are stored.

The singleton is an explicit product boundary for the current single-reader
Atlas installation, not an account identity. Multi-profile support must add a
new partition key and schema migration; it must not reinterpret this row.

## Atomic compare-and-swap

Initialization creates the table and inserts the canonical empty profile only
when no row exists. Existing malformed or unknown-version rows are never
replaced by defaults.

Every update:

1. validates the complete profile against the current metadata bibliography;
2. requires `next.revision = expectedRevision + 1`;
3. enters the shared database's exclusive transaction;
4. reads the current row and validates its SQL envelope and JSON payload;
5. rejects corruption as unavailable;
6. compares the exact expected revision;
7. updates using a revision predicate and bound SQL parameters;
8. returns `saved` only when exactly one row changed.

A stale writer returns `conflict`. SQLite busy/locked errors are retryable
conflicts. Other database failures return `unavailable`. No non-boolean or
truthy adapter result is treated as a successful write.

## Corruption and migrations

A corrupt JSON payload, SQL/envelope revision mismatch or unsupported schema
version is returned as an invalid value for the core validator. It is never
converted into the default profile and is never overwritten by compare-and-
swap. No automatic migration is attempted.

A future schema change requires an explicit versioned migration and tests for
interruption and rollback.

## Privacy and platform behavior

The adapter stores metadata-only preferences in the app's local SQLite file.
It does not call the network, read EPUBs or pass data to a model provider.
The adapter does not claim application-level encryption; deployments requiring
database-level encryption must provide it at the host/database layer.

The Expo composition wrapper reuses the same database handle as cursor
progress. It does not open or close a second connection. Web remains
unavailable because the existing Hoid database port requires native exclusive
SQLite transactions.

## Screen integration

`HoidTrustedScreenHost` obtains the preference store through the Expo factory
and passes it to `HoidScreen`. The screen mounts
`HoidReaderPreferencesEditor`, which:

- loads and validates the persisted profile before enabling controls;
- lets the reader prioritize or deprioritize catalogued works;
- preserves the order in which priorities were selected;
- changes the display limit to 1, 3 or 5;
- uses compare-and-swap for every edit and reloads after a revision conflict;
- provides an explicit reset that advances the revision rather than deleting
  or silently replacing the row.

The screen applies `rankHoidCuratedPathRecommendationsForReader()` only to the
already trusted signed display projection. If the preference store is
unavailable or corrupt, the editor is disabled and the default editorial order
is retained. Preferences cannot add a work to the projection or change its
spoiler eligibility.

The app entry point still does not provision the curated-path trust authority,
so there are no real editorial recommendations to rank yet. The editor is
usable for setting local preferences in preparation for approved routes, but
this run does not activate narrative recommendations or change reading
progress.
