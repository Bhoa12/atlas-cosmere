# Run 305 — Vault generation fencing

## Purpose

Add a generation-fenced facade for the encrypted conversation Vault, matching the source/target protocol used by the SQLite participant without coupling the Vault to a specific key, AEAD or blob provider.

## Runtime boundary

Factory: `createHoidConversationVaultGenerationFencedAdapter(vault, fenceStore, binding)`.

It returns a fenced Vault facade and a `vault-history-v1` participant. The host must discard the unfenced Vault reference and must not expose it to the history bridge or UI.

Every restore/save/clear operation:
1. Acquires the partition's shared exclusive gate.
2. Reads and validates the durable fence record.
3. Requires the exact session, bound generation and active state.
4. Holds the gate across the entire awaited Vault operation.
5. Fails closed when the gate or record is unavailable or malformed.

The participant uses the same gate for fence and activate. An in-flight operation therefore finishes before fencing commits, or fencing commits first and the old facade is rejected. A stale facade never becomes current after a later generation is activated; the host constructs a new facade bound to that generation.

## Native store contract

`HoidVaultGenerationFenceStorePort.withExclusive` is stronger than a JavaScript mutex. Production must serialize every adapter and process for the partition, release safely after process death, hold the gate across the callback, and persist create/CAS atomically. The in-memory store in tests is only a deterministic test double; it proves the protocol, not native cross-process exclusion or crash recovery.

The fence row is not automatically a hardware-backed monotonic anchor. The host must compare it with the rollback-resistant authority journal before exposing the adapter. A rollback-restored fence store must cause the host to block.

## State transitions

- Source initialization: active(g).
- Target initialization: inactive(g).
- Fence: active/inactive(g) -> fenced(g+1, operationId).
- Activation: fenced(g+1, operationId) -> active(g+1, operationId).

Fence is idempotent for the same operation ID. Activation is idempotent for the matching operation. A target cannot fence an active row and a participant cannot activate a different operation.

## Spoiler and privacy invariants

The fence stores only opaque partition/session identifiers, generation, state and operation ID. It does not store progress permissions, assistant authorization, provider payloads, citations, EPUB paths, chapter text or summaries.

The facade is consumed through the existing history bridge. The bridge must still rehydrate snapshots against live book/chapter progress before returning assistant messages. Generation validity is not narrative authorization.

## Deliberate non-goals

This run does not implement Android Keystore/iOS Keychain, a hardware-backed monotonic counter, a production cross-process lock, an atomic transaction spanning fence/blob/checkpoint, a live SQLite-to-Vault migration, or HoidScreen activation.

The Vault's existing blob-then-checkpoint sequence can leave a mismatch after a crash. The Vault blocks that restore; repair/reconciliation is separate and must never fall back to an older transcript.

## Validation

The dedicated workflow runs the new fence suite, Vault and history-bridge regressions, then strict TypeScript checking. Results must be checked on the final branch HEAD.
