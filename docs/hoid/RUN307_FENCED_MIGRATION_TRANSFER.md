# Run 307 — fenced canonical history migration transfer

## Purpose

Connect the Run 306 canonical snapshot codec to the SQLite and encrypted Vault
generation-fenced adapters without exposing ordinary application stores to a
migration. The transfer port is suitable for the existing crash-resumable
migration runner, but this run does not enable a production migration.

## Migration-only capability

Both generation-fenced adapters now return a `migration` capability in
addition to the normal store and fencing participant.

The capability is bound to the adapter's partition and accepts an operation ID
and generation on every call:

- `read` is allowed only while that exact operation owns the fenced generation.
- `replace` and `clear` are additionally restricted to the target role.
- The capability rejects calls before fencing, after activation, for another
  operation ID, or for another generation.
- The host must pass this capability to the transfer adapter and must discard
  raw, unfenced stores and Vault references after constructing the adapters.

The capability is intentionally not part of the normal history store or UI
contract. A migration operation cannot be used as a normal conversation read
or write.

### SQLite transaction binding

The SQLite migration capability acquires the database's exclusive transaction,
checks the fence row in that transaction, and constructs a transaction-bound
history store whose nested transaction callback reuses the already-held
transaction. It does not open a second SQLite transaction. The fence check and
the full encrypted history read/CAS therefore share one native transaction.

SQLite v1 has no tombstone/delete operation. Its migration `clear` is a no-op
only when the row is already absent; it returns an explicit unsupported block
for a non-empty row. The adapter never simulates deletion by saving an empty
transcript.

### Vault transaction binding

The Vault migration capability holds the same native exclusive gate used by
normal operations and fencing while it calls the underlying Vault restore,
save or clear operation. The operation ID, generation and fenced state are
checked while the gate is held. The source role is read-only; only the target
role can replace or clear.

The store supplied to the Vault adapter must really implement the declared
cross-runtime linearizable exclusion contract. An in-memory mutex is a test
double, not a production implementation.

## Canonical transfer adapter

`createHoidHistoryMigrationSnapshotTransferAdapter()` binds one SQLite and one
Vault migration capability to an opaque partition and the Run 306 codec.

Copy behavior:

1. Re-read the fenced source and target.
2. Validate each snapshot with the canonical, text-only, progress-scoped codec.
3. Compare canonical SHA-256 digests.
4. If the target already has the source digest, treat the operation as an
   idempotent retry and do not write again.
5. Otherwise replace the target using its current revision as a CAS expectation.
6. Re-read the target and require the digest to match before returning a copy
   result.

Verification independently re-reads both source and target. It checks source
revision/digest stability and the exact target revision/digest; it never echoes
the values returned by copy.

An empty source uses a fixed, domain-separated empty-history digest and does not
invent a synthetic reading-progress scope. A non-empty Vault target can be
cleared with a Vault tombstone. A non-empty SQLite target cannot be cleared in
schema v1, so that direction fails closed rather than pretending a deletion
occurred.

## Spoiler invariant

The transfer codec validates the saved progress scope but does not authorize
old assistant prose for the reader's current position. After migration, the
receiving conversation bridge must hydrate the snapshot against the live book,
edition and chapter progress. If progress is missing or has changed, old Hoid
answers are discarded while safe user-authored messages and the fixed greeting
may remain.

The digest is a comparison/integrity identifier, not an authenticity signature,
an AEAD tag or an anti-rollback anchor.

## Validation

The dedicated workflow runs:

- canonical transfer adapter tests;
- Vault generation-fence tests, including migration-only capability tests;
- SQLite generation-fence tests, including transaction-bound migration tests;
- migration runner regressions;
- snapshot codec regressions;
- strict TypeScript checking.

## Explicit limitations

- The SQLite generation row remains in the rollback-restorable SQLite file.
- A hardware-backed monotonic journal adapter is not implemented here.
- The Vault cross-process gate is still an injected native port; no Android or
  iOS implementation is claimed.
- No production key provider, AEAD, checkpoint or blob store is selected.
- No real migration is activated and HoidScreen is not wired to these ports.
- The empty-source to non-empty SQLite target case remains unsupported until a
  separately reviewed SQLite tombstone/schema migration exists.
- No EPUB body, XHTML, passage, chapter prose or generated narrative summary is
  read or committed by this run. Private EPUBs remain a source catalog only.
