# Run 301 — single-writer conversation history authority

## Goal

Make the existing SQLite history store and encrypted conversation vault mutually
exclusive choices at the conversation composition boundary. This run adds a
provider-neutral authority facade; it does not migrate data or activate either
backend in the production application.

## Backend adapters

Two adapters implement the same narrow authority contract:

- `createHoidSqliteConversationHistoryAuthorityBackend()` delegates to the
  existing canonical history store port. Revision `0` maps to SQLite's
  create-only `null` CAS expectation; positive revisions map directly.
- `createHoidVaultConversationHistoryAuthorityBackend()` delegates to the
  existing session-bound vault history bridge. It retains the vault's
  encrypted revision and tombstone semantics.

The SQLite v1 schema has no tombstone. Its `clear()` result is explicitly
`unsupported`; the adapter never pretends that saving an empty transcript is
secure deletion. The vault backend can clear through its existing tombstone
operation.

Both adapters expose the same normalized result vocabulary: `empty`, `ready`,
`stale` or `blocked` for restore; `saved`, `conflict`, `invalid-input` or
`blocked` for writes; and `cleared`, `conflict`, `unsupported`,
`invalid-input` or `blocked` for deletion. Revisions use one field named
`revision`, so callers do not need to branch on SQLite's
`storageRevision` or Vault-specific error unions.

## Single-writer composition

`createHoidConversationHistoryAuthority()` accepts one exact selection
record containing one branded backend. It rejects:

- extra backend properties or fallback lists;
- arbitrary/unbranded backend objects;
- accessor-backed selection records;
- malformed authority IDs;
- a second live authority with the same authority ID in this JavaScript
  runtime.

The authority serializes restore, save and clear operations through one
per-instance queue. It captures the selected backend once and never falls back
to the other backend after an error. Backend exceptions become a blocked
result.

The authority ID must be a stable opaque identifier for the exact
principal/conversation partition. It must not contain a name, email address or
other personal data.

## Revision semantics

The common facade uses revision `0` for an absent conversation:

- SQLite maps `0` to `expectedStorageRevision = null` (create-only);
- the vault uses its native revision `0` for an empty partition;
- every successful write advances exactly one revision in the selected
  adapter.

The existing adapters remain responsible for their durable CAS behavior.
The facade's queue prevents overlapping operations through one instance; it
does not replace SQLite/vault CAS.

## Disposal and concurrency limits

Disposal prevents queued operations from starting and suppresses results from
an operation that completes after disposal. It cannot cancel an adapter call
that is already in flight; that call may still commit. The in-process
partition reservation is released only after the queued work settles.

The module-local reservation is a composition guard, not a durable lease. It
does not coordinate another process, another device, a second JavaScript
runtime, or a caller that deliberately supplies a different authority ID.
Cross-process safety still depends on the selected backend's CAS.

## Migration is deliberately not implemented

There is no automatic SQLite-to-vault copy, no dual-write, and no fallback
read. A safe migration still requires a durable authority journal and
fencing-generation contract that every writer enforces, a source write
barrier, canonical snapshot verification, an atomic authority switch, and
restart/recovery tests for every interruption point. The current SQLite and
vault adapters do not share such a cross-backend fencing token, so attempting
a migration now would create a split-brain risk.

Production activation remains blocked until the host selects one backend,
provides reviewed native AEAD/key management and anti-rollback guarantees,
defines retention/deletion behavior, and completes Android/iOS device tests.
The app remains fail-closed.

## Spoiler and privacy invariants

- Both adapters retain the existing progress-bound history hydration policy.
- Stale progress never restores prior Hoid prose; only user-authored messages
  and the exact static greeting survive.
- The authority does not persist reading permissions, provider payloads,
  evidence, citations or EPUB locators.
- No private EPUB body, XHTML, passage, image, extracted text or private path
  is read or committed by this run.
- The user's bibliography remains a source catalogue, not proof that a
  particular passage has been inspected.

## Validation

The dedicated workflow runs the authority tests together with the existing
history-store, vault bridge, hydration and vault regression suites, plus
TypeScript strict checking. CI must be checked on the final branch HEAD before
this draft is treated as validated.
