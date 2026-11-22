# Run 222 — Key rotation identity and canonical envelope hardening

## Scope

Run 222 hardens the Run 221 key lifecycle and managed AEAD boundary. It does
not add a native key vault, an AEAD primitive, a platform adapter, or an
application activation path.

## Immutable key-generation identity

Every successful rotation must advance the active key version by exactly one
and must produce both:
- a new key ID distinct from the previous generation;
- a new opaque key handle distinct from the previous generation.

The old key ID must continue to resolve to the old key in decrypt-only state.
A provider that reuses an ID or handle is rejected. Handles are therefore
immutable references to one key generation, not mutable aliases to an active
slot.

This prevents a vault from changing the material behind a historical key
reference while leaving old ciphertext metadata apparently valid.

## Canonical envelope serialization

The managed protector accepts only the exact JSON serialization emitted by
its canonical envelope encoder. Parsing is followed by strict shape and field
validation, then a byte-for-byte string comparison with the canonical
serialization.

This rejects duplicate JSON member names, alternate field ordering,
insignificant whitespace and other alternate encodings before the key manager
or cipher is called.

The cryptographic authentication remains the responsibility of the AEAD
provider. Canonical serialization is an additional parsing and protocol
boundary; it does not replace AEAD authentication.

## Nonce contract

The AEAD provider must generate nonces with a cryptographically secure random
source and must never reuse a nonce with the same key:
- AES-256-GCM: 96-bit nonce;
- ChaCha20-Poly1305: 96-bit nonce;
- XChaCha20-Poly1305: 192-bit nonce.

The managed adapter validates the encoded nonce length and canonical base64url
representation. It cannot prove nonce randomness or uniqueness; those
properties must be guaranteed and tested by the native cryptographic provider.

## Verification

New regression tests cover key-ID reuse, key-handle reuse, duplicate JSON
members, whitespace and non-canonical envelope representations. Existing
rotation retention, associated-data binding, malformed envelope and
fail-closed tests remain in place.

CI runs the key lifecycle and managed AEAD suites plus strict TypeScript.

## Production limitations

No cryptographic primitive or Keychain/Keystore integration is added here.
No test cipher is represented as production encryption. The host must still
supply a reviewed AEAD provider and non-exportable key-vault integration,
then validate nonce generation, interruption, concurrency, backup, loss,
rotation and deletion on real Android and iOS devices.

Conversation persistence remains inactive.

## Source and privacy handling

No EPUB, XHTML, protected passage, image, chapter text or unreviewed narrative
claim is included. The private Cosmere and Roshar bibliography remains a
catalogue of sources only.
