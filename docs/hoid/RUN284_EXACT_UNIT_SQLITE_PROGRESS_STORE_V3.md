# Run 284 — exact-unit SQLite progress store v3

## Objective

Add a durable SQLite adapter for the exact-unit v3 progress contract from Run 283. The adapter is provider-neutral at the Hoid boundary: it consumes the existing structural SQLite port and does not import Expo, React, a model SDK, or a network client.

This run adds persistence and a guarded v2 -> v3 migration. It does not make v3 the active Atlas progress authority.

## Storage layout

The adapter adds two tables:

- `hoid_unit_progress_ledger`: the v3 exact-unit snapshot.
- `hoid_unit_progress_migrations`: a one-row v2 -> v3 receipt containing source/target schema versions, source revision, the exact metadata-only v2 payload, and a canonical migration timestamp.

It reuses, without rewriting:

- `hoid_progress_ledger`: retained v1 source.
- `hoid_cursor_progress_ledger`: retained v2 cursor source.
- `hoid_progress_migrations`: the existing v1 -> v2 receipt.

The v1 and v2 payloads contain reading metadata only. No EPUB, XHTML, prose, chapter title, summary, claim, or provider output is copied into the v3 tables or receipt.

## Migration sequence

1. Ask `ExpoSqliteHoidCursorProgressStore` to load v2. This preserves the existing v1 -> v2 migration and its validation rules.
2. Create the v3 and v2 -> v3 receipt tables inside an exclusive transaction.
3. Inside one exclusive transaction, re-read v1, v2, and the v1 -> v2 receipt.
4. Revalidate the retained v1 payload and its exact receipt binding; validate the current v2 snapshot against the edition manifests.
5. If a v3 snapshot and receipt already exist, require both and verify that the retained v2 row still matches the exact source revision and payload recorded by the v2 -> v3 receipt.
6. If neither v3 record exists, convert every v2 position. A partial cursor is resolved again through `createHoidUnitProgressCursor()`; book, chapter number, unit ID, and ordinal must all match the v2 cursor. Explicit whole-work completion and optional order are preserved.
7. Validate the complete v3 candidate. If any position cannot be represented exactly, reject the whole migration; no position is dropped.
8. Insert the v3 snapshot and v2 -> v3 receipt in the same exclusive transaction. A failed receipt insert throws so SQLite rolls back both writes.

The migration preserves the v2 revision and timestamp. The v3 ledger begins at that same revision; its next successful compare-and-swap increments it normally.

## Mixed-version rollout guard

The v2 source is retained and becomes immutable from the v3 adapter's perspective.

If a still-running v2 writer changes the v2 payload after v3 migration, the adapter returns `source-changed` and blocks v3 reads and writes. It does not silently choose v2, merge the snapshots, or fall back to an older progress value.

The v1 -> v2 chain is also rechecked inside the v3 transaction. A changed or incomplete v1 receipt chain blocks the v3 operation.

Migration receipts are consistency records, not cryptographic signatures or authentication proofs. They detect accidental and mixed-version divergence; they do not protect against an attacker who can rewrite the entire local database and every receipt.

## Compare-and-swap

`ExpoSqliteHoidUnitProgressStore` implements `HoidUnitProgressStore`:

- `read()` returns the validated v3 snapshot or null when storage cannot be trusted.
- `load()` returns a typed migration/read status and indicates whether this call performed v2 -> v3 migration.
- `compareAndSwap(expectedRevision, next)` validates the complete v3 snapshot before reading its fields, then rechecks both migration chains and the current v3 revision inside an exclusive transaction.
- Only an update that changes exactly one row returns true.
- Stale revisions, source divergence, invalid snapshots and SQLite busy conditions never report a successful write.

The adapter coordinates writers sharing the same SQLite database file. It is local-device persistence, not cloud synchronization or cross-device conflict resolution.

## Spoiler and editorial boundary

The v3 store persists only exact structural identity and reader progress metadata. It does not authorize narrative evidence, approve editorial claims, or infer that an open unit has been completed.

The v3 cursor validator rechecks its exact chapter reference and contiguous ordinal prefix against the current edition manifest. The EvidenceRuntime must continue to apply its own progress, first-safe-appearance, evidence-unlock, provenance, and editorial-attestation checks.

The adapter does not inspect private EPUB files. Tests use synthetic metadata fixtures only.

## Integration status and limitations

- The adapter is implemented and tested against the structural SQLite port.
- It is not wired into `CosmereContext`, `App.tsx`, `HoidScreen`, or the production EvidenceRuntime.
- The current Atlas v2 coordinator remains the active progress source until a separately reviewed composition change is made.
- No real user progress is migrated or modified by this branch alone.
- CI uses a transaction-copy test double. This is not a substitute for native SQLite tests on Android and iOS.
- Before v3 can become authoritative, verify device restart, interrupted migration/rollback, concurrent v2/v3 writers, app downgrade, and progress-to-evidence authorization on real Android/iOS builds.
- Web remains unsupported by the existing exclusive SQLite transaction port unless a separate transactional adapter is supplied.

## Tests

`unitSqliteProgressStore.test.ts` covers:

- empty and populated v1 -> v2 -> v3 initialization;
- preservation of exact-unit identity, completion, order, revision, and timestamp;
- use of the latest v2 snapshot before first v3 migration;
- idempotent reads after migration;
- v3 compare-and-swap, stale writers, and concurrent writers;
- detection of v1 and v2 source changes after migration;
- missing and orphaned v3 receipts;
- corruption without fallback to v2;
- rollback when the v3 receipt insert fails and successful retry;
- accessor-backed hostile snapshots without invoking getters;
- invalid source data and invalid migration timestamps.

The dedicated workflow also reruns the v2 SQLite migration and ledger/runtime regression suites, then performs strict TypeScript checks over the complete persistence boundary.
