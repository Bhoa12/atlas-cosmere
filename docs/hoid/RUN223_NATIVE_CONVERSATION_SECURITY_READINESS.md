# Run 223 — Native conversation security readiness gate

## Purpose

Run 223 adds a fail-closed readiness gate between the existing provider-neutral
key-management/AEAD contracts and any future application activation path.

The gate is deliberately not a Keychain, Android Keystore or cipher
implementation. It evaluates a canonical capability declaration supplied by
the native host together with the runtime facts observed by the composition
root.

## Required capability declaration

The version-1 declaration binds one provider identity across:

- the native key vault;
- the authenticated-encryption provider;
- the shared Atlas SQLite connection.

It requires:

- iOS Keychain on iOS or Android Keystore on Android;
- non-exportable key material;
- native secure key generation;
- retention of previous key generations for historical decryption;
- authenticated encryption;
- opaque key handles only across the JavaScript boundary;
- native CSPRNG nonce generation;
- per-key nonce uniqueness enforcement;
- an AEAD algorithm already supported by the managed envelope;
- the shared SQLite connection and exclusive transactions.

The runtime must also confirm a native build, secure storage availability,
matching platform and exclusive SQLite transaction support. Web is always
blocked.

## Result semantics

The readiness evaluator returns:

- "ready": the declared stack satisfies every required capability;
- "blocked": one or more stable reason codes explain why activation is denied.

Malformed objects, extra properties, accessors, inherited objects, sparse
arrays, duplicate algorithms and unknown algorithms fail closed. The
capability declaration is copied into canonical records before evaluation.

The selected AEAD algorithm is deterministic and follows the order declared
by HOID_CONVERSATION_SECURITY_ALGORITHMS.

## Trust limitation

This gate is a configuration and composition check, not hardware attestation.
A JavaScript object cannot prove that a native provider is truthful, that a
key is actually non-exportable, or that a nonce source is cryptographically
secure.

Before a provider can declare readiness in production, it still requires:

1. independent review of its native iOS and Android implementation;
2. provider conformance tests against the key and cipher ports;
3. device tests for nonce uniqueness, interruption, concurrency, rotation,
   previous-key retention, backup, key loss and deletion;
4. verification that key bytes never cross into JavaScript;
5. verification that SQLite uses the shared Atlas connection and exclusive
   transactions.

A provider must not manufacture a successful capability declaration merely to
unlock the application. Until a reviewed provider exists, the application must
continue to treat conversation persistence as unavailable.

## Verification

The readiness test suite covers valid iOS and Android declarations,
deterministic algorithm selection, platform mismatch, web, native-build and
secure-storage requirements, provider identity, platform key-store selection,
non-exportable key requirements, native key generation, rotation retention,
AEAD, opaque handles, CSPRNG and nonce uniqueness, algorithm availability,
shared SQLite transactions, malformed objects, getters, inherited objects,
sparse arrays and immutability.

No native provider, cryptographic primitive, key material, EPUB content or
narrative claim is added by this run.
