# Run 220 — Local principal identity provisioning

## Scope

Run 220 introduces an installation-local, pseudonymous principal identity for
partitioning Hoid conversation history. It does not create an Atlas account,
authenticate a person, enable cross-device synchronization or activate
conversation persistence.

## Identity model

- One singleton identity is stored in `hoid_local_principal_identity_v1`.
- The identifier is `hlp1_` followed by 192 bits rendered as lowercase hex.
- A new identity can only be provisioned from an injected cryptographically
  secure random source.
- Existing identities are read without invoking the random source.
- The visible profile name, nickname, email, device model and OS identifiers
  are never consulted.
- The identifier is pseudonymous, not secret and not an authentication token.

## Storage and concurrency

The SQLite adapter uses the shared `getExpoHoidDatabase()` handle and a
singleton row guarded by an exclusive transaction plus `INSERT OR IGNORE`.
Concurrent first-run provisioners converge on the row that wins the atomic
insert. A malformed existing row is reported as invalid and is never replaced.

The identity table is separate from the progress ledger and conversation
history tables. It has no reset/delete operation in this run: deletion must be
coordinated with conversation-key destruction and retention policy.

## Entropy boundary

The core accepts a `HoidSecureRandomPort`. The caller must supply bytes from a
platform cryptographic random-number generator. There is no fallback to
`Math.random`, timestamps, display names or device identifiers.

The Expo composition function is deliberately not called during application
startup. A reviewed native CSPRNG adapter and lifecycle tests are still
required before identity provisioning is activated in the UI.

## Security boundaries

- This identifier is not proof of identity and must not authorize access.
- It is local to one app installation and is not suitable for account recovery.
- It is not an encryption key.
- The SQLite value is a pseudonymous partition key, not secret material.
- Secure key storage, AEAD implementation, key rotation and coordinated deletion
  remain separate work.
- Web persistence remains unavailable.

## Privacy and sources

No EPUB/XHTML, source passages, chapter prose, images, summaries, provider
prompts, editorial approvals or trust keys are included. The private Cosmere
and Roshar EPUBs remain catalogue sources only.
