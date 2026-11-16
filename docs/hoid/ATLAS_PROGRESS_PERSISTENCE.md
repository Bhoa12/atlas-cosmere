# Atlas progress persistence

## Purpose

This integration makes the versioned Hoid Progress Ledger the persisted source of truth for the reading progress exposed by Atlas. The React context is a projection of the validated ledger snapshot; it is not an independent authorization store.

## Startup sequence

1. A fresh React context starts with empty, null-prototype progress maps and status `loading`.
2. The native composition adapter opens `atlas-cosmere-hoid.db`.
3. `ExpoSqliteHoidProgressStore` initializes or reads the versioned ledger.
4. `HoidProgressCoordinator` validates the snapshot through `HoidProgressLedger`.
5. Only a `ready` snapshot is projected into Atlas chapter and completion maps.
6. Reading controls and Hoid questions remain disabled while loading or when storage is unavailable.

Corrupt or unreadable persisted data is never replaced with an empty snapshot automatically. The UI remains fail-closed and requires an explicit recovery path rather than silently resetting authorization state.

## Write semantics

- Setting a chapter is an explicit reader action.
- Moving backwards requires the coordinator's explicit regression option.
- Setting a book as read records a distinct completion state and passes the ledger's explicit confirmation flag.
- Marking a completed numeric work as unread reopens it at chapter 1.
- Reopening a completed work to a chosen chapter requires an explicit reopen option.
- Unsegmented collections such as Arcanum ilimitado and the merged Arena blanca volumes cannot be reopened using an invented numeric cursor; the edition validator rejects that operation.

The coordinator serializes writes in one application instance. SQLite's revision predicate remains the final compare-and-swap guard. A conflict refreshes the local snapshot but does not silently replay the user's operation.

## Platform and scope

- Native Android/iOS only in this integration.
- Expo SDK 51 uses the rewritten async SQLite API. The project pins the SDK-compatible `expo-sqlite` dependency to `~14.0.6`.
- `withExclusiveTransactionAsync` is not supported on web. Web requires a separate adapter and integration tests; this implementation deliberately does not fall back to a weaker transaction.
- Persistence is local to one device. There is no cloud synchronization or cross-device conflict resolution.
- The database contains reading metadata only. It does not contain EPUB content or copyrighted passages.

Official API references:
- [Expo SDK 51 release notes](https://expo.dev/changelog/2024-05-07-sdk-51)
- [Expo SQLite transaction documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## Failure policy

If opening the database, initializing the table, reading a snapshot or writing a change fails, Atlas reports persistence as unavailable. Hoid does not use the empty initial maps as proof that the reader has read nothing, and it does not ask a model provider to compensate for missing progress.

A later recovery workflow may offer export, backup or explicit reset, but no automatic destructive repair is permitted.


## Test scope and legacy migration debt

The dedicated progress workflow runs the coordinator, ledger, SQLite-store and fresh-profile suites, plus a strict TypeScript check of the app integration. A separate attempt to run the entire historical `src/hoid` suite exposed older tests that still use placeholder work IDs, the pre-edition-validation reading shape (including `completed: false` alongside a chapter), or implicit Vitest globals. Those legacy pipeline/snapshot tests are not evidence that the new coordinator failed; they require a separate migration to the current bibliography-bound contracts. The full legacy suite is therefore not reported as green by this workflow.
