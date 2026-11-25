# Run 303 — crash-resumable history migration runner

## Scope

This run adds the orchestration layer between the durable authority journal,
the two generation-fencing participants and a provider-neutral snapshot
transfer port. It can drive a migration protocol with compliant adapters, but
it does not register or activate production adapters.

## Responsibilities

start(operationId, targetBackend)
- journal.begin
- fence source
- acknowledge source fence
- fence target
- acknowledge target fence
- copy canonical snapshot
- record source/target revisions and digests
- re-read and verify target
- journal.verifyCopy
- journal.commit (authority linearization point)
- activate target
- journal.completeActivation

resume(operationId)
- read durable journal
- continue from its persisted phase

abort(operationId)
- allowed only before commit
- journal.beginAbort
- reactivate source at the advanced generation
- journal.completeAbort

## Port contracts

- HoidHistoryFencingParticipantPort
- HoidHistoryMigrationTransferPort
- HoidHistoryAuthorityJournalCoordinator

The participant adapter must make fence and activate idempotent and must
enforce the generation token on every ordinary read, save and clear operation
inside the same atomic storage boundary as the history mutation. A separate
preflight generation check followed by a later write is not fencing: it leaves
a time-of-check/time-of-use race.

The transfer adapter owns the versioned allow-listed export/import codecs. Its
copy operation must be idempotent by partition, operation and generation.
Its verify operation must re-read the durable target and calculate the
canonical target digest; echoing the earlier copy result is not verification.

The runner accepts only exact data records, rejects getters and extra fields,
captures methods at construction, validates schema version 1, revisions and
lowercase SHA-256 digests, and serializes calls within one runner instance.
The journal CAS and participant fencing remain responsible for cross-runtime
coordination.

## Recovery and failure semantics

- A source fence acknowledged in the journal is not repeated on resume.
- A target fence failure leaves the journal in fencing; copy is not called.
- A copy failure leaves the journal in copying; resume may retry the
  idempotent transfer.
- A digest or target-revision mismatch leaves the journal before commit.
- After commit, the journal names the target as authority. Target activation
  failure leaves activating; the runner never falls back to source.
- Abort is available only before the authority commit. It reactivates the
  source at the new generation and leaves the target fenced.
- Exceptions and malformed adapter results fail closed. No automatic retry
  loop is performed; callers may invoke resume after the adapter recovers.

## Privacy and spoiler constraints

The runner sees only opaque partition/operation identifiers, backend kinds,
revisions and digests. Snapshot bytes or text never enter the journal or the
runner contract. The transfer adapter must move only the canonical conversation
history schema, not provider payloads, prompts, permissions, citations, EPUB
locators, XHTML, extracted passages or book text.

After migration, the receiving history adapter must still hydrate the snapshot
against the live reading-progress scope before presenting any prior assistant
response. A migration digest proves byte identity, not spoiler authorization.

The private Cosmere and Roshar bibliography remains a metadata-only catalogue
for this run. No EPUB body or protected passage was read or committed.

## Validation

The Vitest suite uses in-memory journal and participant test doubles. It tests
ordering, resumability, digest mismatch, target revision drift, post-commit
activation failure, pre-commit abort, malformed adapter output and concurrent
calls to one runner instance.

These tests do not prove:
- hardware-backed anti-rollback;
- Android Keystore or iOS Keychain implementation correctness;
- cross-process fencing in SQLite or Vault;
- power-loss durability of native stores;
- production migration safety.

Production migration remains disabled until native journal anchoring,
generation enforcement in every storage operation, reviewed transfer codecs
and device-level crash/restart tests exist.
