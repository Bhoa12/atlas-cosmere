# SQLite cursor progress store v2

## Purpose

`cursorSqliteProgressStore.ts` adds a native SQLite persistence adapter for the edition-bound cursor snapshot introduced by the v2 progress contract. It does not replace the existing v1 production coordinator or screen composition.

## Storage layout

The adapter maintains three records:

- `hoid_progress_ledger`: the existing v1 source row. It is retained after migration.
- `hoid_cursor_progress_ledger`: the validated v2 snapshot.
- `hoid_progress_migrations`: a one-row migration receipt recording source schema, target schema, source revision and migration time.

The v2 snapshot and migration receipt are written in the same exclusive SQLite transaction. A failed insert throws from the transaction callback so SQLite rolls back both writes. The v1 row is never deleted or rewritten by this adapter.

## Load and migration behavior

`load()` follows this order:

1. Create the v1, v2 and migration tables if they do not exist.
2. Insert an empty v1 snapshot only when no v1 row exists.
3. If both v2 and a valid migration receipt exist, validate and return v2.
4. If only one of v2 or the receipt exists, fail closed.
5. If neither exists, acquire an exclusive transaction and re-check both records.
6. Decode and validate the complete v1 source through `migrateHoidProgressV1ToV2()`.
7. Refuse the entire migration if any work or chapter has no unambiguous edition-bound cursor.
8. Re-read the v1 row inside the same transaction and compare schema, revision and payload.
9. Insert the v2 snapshot and migration receipt atomically.

Concurrent first readers re-check state inside the exclusive transaction. The first successful migration writes both records; subsequent readers return the committed v2 snapshot. A migration failure leaves v1 intact and retryable.

## Failure policy

The adapter distinguishes:

- `corrupt-v1`: the source row or JSON envelope is invalid.
- `ambiguous-v1`: a valid v1 position cannot be mapped to an exact edition cursor.
- `corrupt-v2`: the v2 envelope, snapshot or migration receipt is invalid.
- `migration-marker-missing`: a v2 row exists without its receipt.
- `migration-marker-orphaned`: a receipt exists without its v2 row.
- `migration-conflict`: SQLite reports a transient lock while loading/migrating, or the source revision guard fails.
- `storage-error`: another storage operation fails.

An invalid v2 row never falls back to v1. Doing so could silently resurrect stale progress after a newer snapshot had been written.

## Compare-and-swap

`compareAndSwap(expectedRevision, next)`:

- validates the complete v2 snapshot before reading its fields;
- ensures migration has completed;
- opens an exclusive transaction;
- verifies the migration receipt and current v2 snapshot;
- updates only when the stored revision equals `expectedRevision`;
- returns true only when exactly one row changed.

The operation coordinates writers sharing the same SQLite database file. It is local-device persistence, not cloud or multi-device synchronization.

## Integration status

This adapter is deliberately not wired into `CosmereContext`, `App.tsx` or `HoidScreen` yet. The existing v1 coordinator remains the production source of progress until:

1. the adapter passes CI and native Android/iOS integration tests;
2. the app composition root can surface typed migration failures instead of treating null as an empty snapshot;
3. a cursor-native coordinator replaces the v1 numeric coordinator;
4. HoidScreen reads the same validated v2 snapshot that authorizes the EvidenceRuntime;
5. rollback, restart, interrupted migration and downgrade behavior are tested on a real SQLite engine.

The pure migration and this adapter never inspect EPUB prose. They use only the existing edition manifests and the v1 reading snapshot.

## Tests

`cursorSqliteProgressStore.test.ts` uses an in-memory SQLite-port test double with transaction-copy/commit semantics. It covers fresh-profile migration, chapter cursor conversion, explicit completion, ambiguous source rejection, corrupt rows, repeated loads, compare-and-swap, stale writers, no fallback from corrupt v2, orphaned receipts and rollback when the receipt insert fails.

These tests validate adapter logic and transaction sequencing. They are not a substitute for native SQLite tests on Android/iOS.
