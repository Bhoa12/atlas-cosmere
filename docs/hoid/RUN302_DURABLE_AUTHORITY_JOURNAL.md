# Run 302 — durable authority journal and migration protocol

## Scope

This run adds a provider-neutral journal contract and a tested transition coordinator.
It does not migrate live conversations, does not select a production backend, and
does not claim that the current SQLite or Conversation Vault adapters enforce
fencing generations.

## Durable journal contract

HoidHistoryAuthorityJournalStorePort requires:

- atomic compare-and-swap on the journal revision;
- persistence across process termination and restart;
- a monotonic revision/generation anchor outside rollback-restorable application
  storage;
- rejection of stale writes after a backup/database rollback;
- exact partition binding and canonical records.

The required capability literal is rollback-resistant-monotonic-cas-v1.
It is a contract declaration, not proof that an implementation is secure.
No production adapter is registered in this run. A SQLite table or
AsyncStorage value alone must not claim this capability.

## Journal state machine

The journal records only metadata; it never stores conversation text, EPUB
locators, prompts, model payloads, citations or extracted book content.

Stable record:
- active backend and monotonic generation;
- journal revision;
- last completed operation outcome.

Migration record:
- opaque operation ID;
- source and target backend;
- next fencing generation;
- source/target fence acknowledgements;
- source/target revisions;
- SHA-256 digest of the canonical exported snapshot;
- phase.

Transitions:

1. initialize: create-only journal at revision 0, generation 0.
2. begin: persist the next generation and enter fencing before touching either
   backend.
3. acknowledgeFence: record source and target acknowledgements. Copying is
   impossible until both are fenced.
4. recordCopy: persist source/target revisions and digests only after the
   canonical snapshot has been copied.
5. verifyCopy: require the target digest to equal the source digest.
6. commit: atomically switch the journal authority to the target and enter
   activating. This is the authority-switch linearization point.
7. completeActivation: clear the migration marker only after the target
   backend confirms activation.
8. beginAbort / completeAbort: before commit, retain the source as authority,
   advance (never decrement) the generation, and clear the migration only after
   the source is reactivated.

Every transition is one journal CAS. Conflicts are returned to the caller;
there is no automatic retry against stale state.

## Fencing participant contract

HoidHistoryFencingParticipantPort describes the future backend barrier.
A compliant adapter must atomically:
- reject all normal operations carrying a generation older than its stored
  generation;
- freeze normal writes while a migration operation owns the fence;
- make fence and activation idempotent by partition, generation and operation;
- prevent a stale process from writing after a newer generation is installed;
- keep the target non-authoritative until the journal commit has succeeded.

The existing sqlite-history-v1 and vault-history-v1 adapters do not implement
this contract. Their current compare-and-swap revisions are not fencing tokens.
Consequently, this run provides a journal protocol and test doubles only; it
does not make migration executable or production-safe.

## Crash recovery rules

- fencing: resume fencing whichever participant has not acknowledged.
- copying: both participants are fenced; re-export/copy must be idempotent by
  operation ID and target CAS revision.
- copied: re-run target verification; do not commit based only on a prior
  copy acknowledgement.
- verified: commit may be retried using journal CAS.
- activating: the target is already the journal authority. Retry target
  activation; never fall back to source.
- aborting: source remains journal authority at the advanced generation.
  Retry source activation; keep the target fenced.
- A crash at any point must fail closed. No phase may silently choose a backend.

## Spoiler and privacy invariants

- Migration moves only the allow-listed conversation snapshot through an
  adapter-owned codec; the journal stores metadata and digests only.
- The receiving backend must re-check the live reading-progress scope before
  any assistant response is hydrated or shown.
- If progress identity is unavailable or differs, prior Hoid prose remains
  filtered. User-authored messages and the canonical static greeting are the
  only retained history.
- Provider payloads, authorization tokens, editorial trust state and EPUB
  paths are not journal fields.
- The supplied Cosmere/Roshar EPUB catalogue remains metadata-only in this run.
  No private book body, XHTML, passage, image or extracted text was read or
  committed.

## Validation and limitations

The Vitest suite uses an in-memory CAS test double. It validates transition
ordering, monotonic generations, digest mismatch rejection, idempotency,
malformed-record rejection and cross-runtime CAS conflicts. These tests do not
prove hardware-backed rollback resistance.

Production migration remains blocked until:
1. Android and iOS provide a reviewed monotonic anchor / native secure storage
   implementation;
2. both storage adapters enforce generation fencing on every normal operation;
3. snapshot export/import uses a versioned allow-listed codec and verified digest;
4. crash-recovery tests run against real platform stores;
5. privacy, retention and deletion semantics are reviewed.

No application screen or production persistence path is connected by this run.
