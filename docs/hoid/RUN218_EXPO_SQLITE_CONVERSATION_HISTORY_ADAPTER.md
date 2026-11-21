# Run 218 — Expo SQLite conversation history adapter

## Purpose

Run 217 defined a provider-neutral conversation-history storage port. This run
adds a native SQLite implementation of that port. It does not wire the adapter
into HoidScreen, create a principal identity, or activate automatic restore.

## Storage table

The adapter creates one independent table in the existing Atlas Hoid database:

- table: hoid_conversation_history_v1;
- partition: (principal_id, conversation_id);
- schema_version: 1;
- storage_revision: monotonically increasing per conversation;
- payload_ciphertext: authenticated encrypted serialized storage envelope.

The table is separate from the reading-progress ledger and its migration
receipt. No progress row, cursor, manifest, or migration marker is changed.

## Encryption boundary

The adapter requires a host-injected HoidConversationPayloadProtector with
seal/open operations. It never writes plaintext JSON to SQLite.

The protection context binds:

- purpose;
- storage schema version;
- principal ID;
- conversation ID;
- storage revision.

A production protector MUST use authenticated encryption (AEAD) and bind every
context field as associated data. A reversible encoding, hash, checksum, or
unencrypted JSON wrapper is not an acceptable protector. Key material must be
managed outside this adapter by a reviewed platform facility such as the
operating system Keychain/Keystore. This repository does not yet provide that
production protector.

The test protector is deliberately reversible and exists only inside the
Vitest suite. It is not an implementation example for production.

## Read behavior

The adapter uses bound SQL parameters for both partition identifiers. It
returns null only when the exact partition is absent.

For an existing row:

- SQL envelope mismatch returns a non-null invalid record to the core;
- authenticated decryption failure throws, which the core maps to unavailable;
- malformed JSON returns a non-null invalid record;
- a decoded envelope must repeat the exact principal, conversation and
  storage revision stored in the SQL columns;
- the core performs the final snapshot and reading-progress hydration.

Corruption is never converted into an empty conversation.

## Atomic compare-and-swap

Writes run inside the shared database's exclusive SQLite transaction:

1. Select the exact partition using bound parameters.
2. For create-only writes, require the row to be absent.
3. For updates, authenticate and validate the existing row and require the
   exact expected storage revision.
4. Insert or update with a revision predicate.
5. Return saved only when exactly one row changed.

SQLITE_BUSY and SQLITE_LOCKED become conflicts. Other database and protector
errors propagate to the core as unavailable. Corrupt existing rows are not
overwritten by a guessed revision.

The adapter coordinates writers using the same SQLite database file. It is
single-device persistence, not cloud synchronization or multi-device conflict
resolution.

## Integration status and blockers

The adapter is implemented against the existing HoidSqliteDatabasePort and
shares the existing atlas-cosmere-hoid.db file when the host supplies that
database instance.

It is NOT wired into CosmereContext, App.tsx or HoidScreen.

Production activation remains blocked until all of the following exist:

1. A stable, non-PII principal partition owned by the app. The current app has
   no authenticated profile identity, so no synthetic shared identity is
   invented.
2. A reviewed AEAD protector backed by platform key management, including
   key-loss and key-rotation behavior.
3. Native Android and iOS tests against real Expo SQLite transactions,
   interruption, restart and lock behavior.
4. A deletion/retention contract and an explicit user-facing history control.
5. A composition-root integration that refreshes the authoritative cursor
   progress before every save and load.

No automatic restore, database write, progress migration, or UI change is
performed by this run.

## Verification

The new Vitest suite uses a transactional in-memory implementation of the
same narrow SQLite port. It covers encrypted round-trip behavior, no plaintext
persistence, partition isolation, stale progress filtering, concurrent
create-only writers, stale CAS, authentication failure, malformed payloads,
corrupt-row preservation, SQL parameter binding and busy-lock handling.

These tests validate SQL adapter logic and transaction sequencing. They do
not replace device-level Android/iOS tests with Expo SQLite.

## Privacy

Only canonical conversation text already authorized by the Run 216 snapshot
can be serialized. The adapter never reads EPUB files or receives source
passages, citations, provider prompts, editorial registries, or trust keys.
Conversation content is encrypted before it reaches SQLite. No protected
Cosmere text, XHTML, images, or private file paths are committed.
