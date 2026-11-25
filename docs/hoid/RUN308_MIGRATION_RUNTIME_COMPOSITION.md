# Run 308 — migration runtime composition and recovery

## Purpose

Run 307 introduced migration-only snapshot capabilities and a canonical transfer
adapter. Run 308 adds a composition root that connects those capabilities to the
durable authority journal and the crash-resumable migration runner.

The runtime is deliberately not a production activation switch. It is a
provider-neutral boundary that prevents the host from accidentally pairing the
wrong source/target roles or passing ordinary stores into the migration path.

## Composition contract

`createHoidHistoryMigrationRuntime()` receives exactly:

- an opaque conversation partition ID;
- a rollback-resistant authority-journal store port;
- the SQLite participant and migration-only capability;
- the Vault participant and migration-only capability;
- the canonical, allow-listed history snapshot codec.

It constructs, internally:

1. the authority journal coordinator;
2. the canonical SQLite/Vault transfer adapter;
3. the migration runner.

The returned runtime exposes only:

- `initialize(activeBackend)`;
- `readAuthority()`;
- `start(operationId, targetBackend)`;
- `resume(operationId)`;
- `abort(operationId)`.

It does not return the ordinary SQLite history store, the raw Vault, blob handles,
key handles, AEAD providers or the underlying journal coordinator.

## Role and direction checks

The two migration capabilities must belong to the same partition and have
complementary immutable roles: exactly one source and one target.

Before journal initialization, the selected active backend must match the
source capability. Before starting a migration, the requested target must match
the target capability and the journal's active backend must still match source.

A pending migration is checked against the same source/target pair before resume
or abort. A different operation ID is rejected. The runner remains responsible
for phase transitions, fencing acknowledgements, copy, independent verification,
authority commit and activation.

To migrate in the opposite direction, the host constructs a new pair of
capabilities with the roles reversed. It must not mutate a capability's role
in place.

## Recovery behavior

The integration suite exercises:

- SQLite to Vault completion;
- Vault to SQLite completion;
- target write committed but acknowledgement lost, followed by idempotent
  resume without a duplicate write;
- abort before authority commit, reactivating only the source;
- rejection of mismatched roles and target direction;
- idle resume before journal initialization.

The runtime serializes operations through the underlying runner. It does not
pretend that in-process serialization replaces the journal's durable CAS or the
Vault gate's cross-process exclusion.

## Spoiler and progress invariant

The transfer adapter validates and copies only the canonical text-only snapshot
schema. A successful migration does not authorize old assistant responses.

After migration, the receiving conversation bridge must hydrate against the
live book, edition and chapter progress. If the progress scope differs or is
missing, old Hoid answers are discarded while safe user-authored messages and
the fixed greeting may remain. The integration suite includes a regression for
this stale-progress case.

## Validation

The dedicated workflow runs the runtime integration suite together with the
authority journal, migration runner, transfer adapter, snapshot codec, history
hydration and both storage-fence suites. It also runs strict TypeScript checking.

## Explicit limitations

- The authority journal port still requires a native rollback-resistant
  monotonic CAS implementation. The test store is in-memory.
- The Vault generation gate still requires a real cross-process native
  implementation. The test fixture is in-memory.
- The SQLite generation row remains in the rollback-restorable database file.
- No hardware-backed anti-rollback guarantee is claimed.
- No production migration is enabled and HoidScreen is not connected.
- No production key provider, AEAD, checkpoint or blob store is selected.
- No EPUB body, XHTML, passage, chapter prose or generated narrative summary is
  read or committed. The private EPUBs remain a source catalog only.
