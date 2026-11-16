# Hoid SQLite Progress Store

## Purpose

`ExpoSqliteHoidProgressStore` is a durable, provider-neutral adapter for the existing `HoidProgressStore` contract. It stores only the versioned reading-progress snapshot. It does not store EPUB content, chapter prose, editorial claims or private book passages.

## Integration

The app owns opening and lifecycle of the database. The Hoid core does not import Expo or SQLite:

```ts
import * as SQLite from "expo-sqlite";
import { HoidProgressLedger } from "../hoid/progressLedger";
import { ExpoSqliteHoidProgressStore } from "../hoid/sqliteProgressStore";

const database = await SQLite.openDatabaseAsync("atlas-hoid.db");
const store = new ExpoSqliteHoidProgressStore(database);
const ledger = new HoidProgressLedger(store);
```

If the installed Expo SQLite type does not structurally match the narrow port, adapt it in the app's composition root. Do not add Expo imports to the Hoid domain layer.

## Atomicity and platform scope

The adapter uses `withExclusiveTransactionAsync` and performs the revision read and conditional update through the transaction object. The SQL update also includes `WHERE id = 1 AND revision = ?`; success requires exactly one changed row.

This gives atomic compare-and-swap for writers sharing the same SQLite database file on supported native platforms. It is **single-device persistence**, not cloud synchronization and not cross-device replication.

Expo documents that `withExclusiveTransactionAsync` is not supported on web. A web build must inject a different store with a concurrency strategy appropriate to its storage backend; it must not silently fall back to a non-exclusive transaction and claim equivalent guarantees.

When SQLite reports `SQLITE_BUSY` or `SQLITE_LOCKED`, the adapter returns `false`, which the ledger treats as a conflict and requires the caller to reread. Other storage failures propagate to the ledger and fail closed.

## Schema

One singleton row is stored in `hoid_progress_ledger`:

- `id`: fixed primary key 1;
- `schema_version`: currently 1;
- `revision`: monotonic optimistic-concurrency revision;
- `payload`: JSON serialization of the canonical ledger snapshot.

The initial row contains the empty revision-0 snapshot. Unknown schema versions, invalid JSON and mismatched row/payload revisions are returned as corrupt data. No automatic migration or repair is attempted.

## Security and data handling

- All dynamic values use SQLite bind parameters.
- SQL identifiers and statements are constants.
- The adapter checks the SQL envelope; `HoidProgressLedger` remains responsible for complete canonical snapshot validation and edition-aware reading-position validation.
- No content from the private EPUB sources is stored here.
- A database backup or sync feature must be designed separately, with account isolation, encryption and conflict policy.

## Verification

`sqliteProgressStore.test.ts` uses a transactional fake implementing the same narrow port. It covers initialization, persistence across store instances, stale revisions, concurrent writers, malformed payloads, unknown schema versions, lock handling and storage failure.

The test does not replace an on-device Expo SQLite integration test. Native runtime verification remains required before wiring this adapter into `HoidScreen`.
