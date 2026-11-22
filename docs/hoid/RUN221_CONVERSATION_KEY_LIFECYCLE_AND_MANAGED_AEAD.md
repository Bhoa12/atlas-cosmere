# Run 221 — Conversation key lifecycle and managed AEAD envelope

## Scope

Run 221 adds a provider-neutral key-management contract and a managed AEAD
payload-protector adapter for Hoid conversation history. It does not ship a
native Keychain/Keystore implementation, a cryptographic primitive, or an
application activation path.

## Key-manager contract

The host supplies HoidConversationKeyManagerPort:

- ensureActiveKey(principalId) is atomic and idempotent;
- resolveForDecryption(principalId, keyId) returns only active or decrypt-only
  keys belonging to the exact principal and key ID;
- rotateActiveKey(principalId, expectedVersion) uses compare-and-swap and
  advances the active version exactly once.

Key descriptors contain an opaque key handle, key ID, version, algorithm and
state. Raw key bytes must never be returned to JavaScript or cross this port.
The handle is a reference to a non-exportable key managed by the platform
vault, not key material.

Supported algorithm identifiers are AES-256-GCM, CHACHA20-POLY1305 and
XCHACHA20-POLY1305. The native provider must advertise and implement only
algorithms it has been reviewed and tested to support.

## Rotation semantics

Rotation creates a new active key and marks the previous key decrypt-only.
The lifecycle boundary verifies the exact new version and re-resolves the
previous key to confirm it remains decrypt-only. Existing ciphertext remains
readable by its exact key ID. The old key must not be destroyed merely because
rotation succeeded.

Key deletion is deliberately absent. It requires a separate migration and
retention proof showing that no retained conversation envelope references the
key. If that proof is unavailable, retaining the decrypt-only key is safer
than making history unrecoverable.

A conflict does not trigger an automatic retry with a guessed revision.

## Managed envelope and AEAD associated data

The managed protector stores a strict JSON envelope with:

- envelope schema version and kind;
- key ID and key version;
- algorithm identifier;
- nonce;
- authenticated ciphertext.

The associated data is a canonical serialization of purpose, storage schema
version, principal ID, conversation ID, storage revision, key ID, key version
and algorithm. A ciphertext copied to another principal, conversation,
storage revision or key version must fail authentication.

Nonce and ciphertext are canonical unpadded base64url strings, including zero
unused trailing bits. AES-GCM and ChaCha20-Poly1305 use a 12-byte nonce;
XChaCha20-Poly1305 uses a 24-byte nonce. The cipher provider is responsible
for actual AEAD authentication and must never reuse a nonce with the same key.

## Failure policy

- Missing or revoked key: fail closed; no fallback to another key.
- Principal, key ID, version or algorithm mismatch: reject.
- Malformed envelope, nonce or ciphertext: reject before invoking the cipher.
- AEAD authentication failure: propagate as unavailable to the storage caller.
- Key-manager or cipher-provider failure: never return plaintext or an empty
  conversation as a substitute.

## Production blockers

The managed adapter is a composition boundary, not a cryptographic
implementation. Production activation remains blocked until:

1. Android and iOS native key-vault adapters use non-exportable keys where
   supported and document platform limitations.
2. A reviewed AEAD implementation is integrated and tested on real devices.
3. Native secure-random generation, nonce uniqueness and key-loss behavior
   are tested.
4. Rotation is tested with old ciphertext, process interruption and concurrent
   writers.
5. Backup/restore, deletion, retention and key destruction policies are
   explicit.
6. The protector is wired into the SQLite conversation store only after those
   checks pass.

No dependency or native module is added by this run. No test cipher is
presented as production cryptography.

## Verification

Vitest tests use deterministic fake key managers and fake AEAD providers only
to verify contracts, canonical envelopes, associated-data construction,
rotation behavior and fail-closed handling. They do not prove cryptographic
security and do not replace native Android/iOS tests.

## Privacy and source handling

No EPUB, XHTML, source passage, image, chapter text, provider prompt or
editorial secret is included. The private Cosmere and Roshar bibliography
remains a catalogue of sources only.
