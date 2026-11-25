# Run 304 — SQLite transaction-bound conversation generation fencing

## Scope

This run adds a generation-fenced adapter for the existing Expo SQLite
conversation-history store. It binds one opaque partition and one exact
principal/conversation key to a generation token and a source/target role.

The existing provider-neutral history store contract is unchanged. The new
factory returns that store together with a
`HoidHistoryFencingParticipantPort` implementation for
`sqlite-history-v1`.

## Atomicity boundary

A new table, `hoid_conversation_history_generation_v1`, stores:

- opaque partition ID;
- exact principal and conversation IDs;
- generation;
- state (`active`, `inactive`, or `fenced`);
- operation ID that performed the latest fence.

The wrapper intercepts every SQL statement that references the conversation
history table. Reads and writes are permitted only when the fence row matches
the adapter's bound partition, principal, conversation, generation and active
state. For writes, the guard query and history mutation execute through the
same `withExclusiveTransactionAsync` transaction object.

The store is bound to one partition. A query for another principal or
conversation is rejected rather than being checked against the first
partition's fence.

## Participant protocol

- A source participant can fence only an active row at the expected
  generation.
- A target participant can fence an inactive or already-fenced row at the
  expected generation.
- Repeating the same fence operation is idempotent.
- Activation requires the exact generation and operation ID.
- Repeating activation for an already-active row is idempotent.
- A store instance retains its construction-time generation forever. After a
  generation change, it remains stale even if the partition is later
  reactivated; the host must construct a new store instance with the new
  generation.

For a source at generation N, configure role `source`, initial generation N
and store generation N. For a target prepared for the next generation,
configure role `target`, initial generation N and store generation N+1.

## Fail-closed behavior

- Missing, malformed or mismatched fence rows never grant access.
- A stale source store cannot read or write after fencing.
- A target store cannot read or write before fencing and activation.
- Unknown SQL statements touching the history table are rejected.
- SQL statements for another principal/conversation are rejected.
- Database errors block the participant operation.

## Security boundary and limitations

This implementation provides transaction-bound fencing among connections
sharing the same intact SQLite database file. It does **not** make SQLite
rollback-resistant: the fence table is part of the same database and can be
restored with an old database snapshot.

Production activation still requires all of the following:

1. a hardware-backed monotonic authority journal outside rollback-restorable
   application storage;
2. a host check that binds the adapter's generation to that journal;
3. an equivalent generation-fenced Vault participant;
4. device tests for process death, concurrent connections, transaction
   interruption and power loss;
5. reviewed native AEAD/key-management implementations.

The new adapter is not wired into HoidScreen and no real migration is run.
The migration runner remains disabled in production.

## Spoiler and privacy constraints

The fence stores only opaque partition identifiers, principal/conversation
keys, generations, states and operation IDs. It never reads or writes EPUB
content, citations, provider payloads, chapter locators, reading progress or
editorial permissions.

Generation fencing is not spoiler authorization. Every restored conversation
must still be hydrated against the live reading-progress scope before any
assistant response is presented.

The private Cosmere and Roshar EPUBs remain a metadata-only source catalogue
for this run. No protected text, XHTML or chapter body is copied into the
repository.

## Validation

The focused test suite exercises source fencing, target activation, stale
instances, idempotence, wrong-partition rejection, malformed inputs and a
write racing with a fence. The CI workflow runs these tests together with the
existing SQLite history and migration-runner regression suites and strict
TypeScript checking.
