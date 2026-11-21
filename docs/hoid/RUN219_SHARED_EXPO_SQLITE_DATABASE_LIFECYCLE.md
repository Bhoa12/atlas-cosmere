# Run 219 — Shared Expo SQLite database lifecycle

## Purpose

Run 218 introduced the encrypted conversation-history adapter against the
same structural SQLite port used by cursor progress. The application previously
opened `atlas-cosmere-hoid.db` inside the cursor coordinator and kept that
handle private, so a future conversation composition could accidentally open a
second connection to the same file.

This run introduces one process-local database provider and makes the cursor
coordinator consume it. Future conversation composition must obtain the same
handle through `getExpoHoidDatabase()`.

## Components

- `sharedSqliteDatabase.ts`: provider-neutral singleton and retry policy.
- `expoHoidDatabase.ts`: Expo/React Native composition boundary and database
  filename.
- `expoCursorProgressCoordinator.ts`: now obtains the shared handle instead
  of opening SQLite independently.
- `sharedSqliteDatabase.test.ts`: concurrency, retry, isolation and lifecycle
  contract tests.

## Lifecycle guarantees

1. Concurrent calls share one in-flight open promise.
2. A successful database handle is reused for the module lifetime.
3. A failed open clears only the failed promise; a later call may retry.
4. Independent provider instances remain isolated.
5. No consumer receives a close/reset method, so one store cannot invalidate
   a handle another store is using.
6. Web remains explicitly unavailable until a separately tested transactional
   implementation exists.

## Integration boundary

The cursor-progress coordinator now obtains the shared handle from
`getExpoHoidDatabase()`. The conversation-history adapter is not yet wired
into the application; its future composition must call the same function and
pass the returned handle to
`createExpoSqliteHoidConversationHistoryStore()`.

This run does not create a profile identity, key, AEAD protector, conversation
store instance, migration, or user-facing history control. It does not change
HoidScreen or enable automatic restore.

## Transaction and data guarantees

The existing progress and conversation tables remain separate. They retain
independent schemas, revisions and authorization policies. Sharing the database
handle does not merge their ledgers or allow conversation writes to mutate
reading progress.

The SQLite adapters continue to use exclusive transactions for writes. The
shared provider only controls handle acquisition; it does not claim cloud
synchronization or cross-device conflict resolution.

## Validation

The pure provider tests cover:

- concurrent open coalescing;
- reuse of the exact same handle by independent consumers;
- retry after a rejected open;
- isolation between provider instances;
- invalid composition input;
- absence of consumer-controlled close/reset operations.

The workflow also type-checks the Expo composition wrapper and the refactored
cursor coordinator. These checks do not replace native Android/iOS device
tests.

## Privacy

No conversation content, EPUB/XHTML data, source passages, citations, summaries,
provider prompts, editorial registries or trust keys are added. No database is
opened or modified during this source-only change. No reading progress is
changed.
