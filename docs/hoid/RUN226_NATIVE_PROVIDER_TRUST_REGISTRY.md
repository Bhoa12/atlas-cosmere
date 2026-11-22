# Run 226 — Root-signed native provider trust registry

## Purpose

Run 224 introduced signed provider attestations, but its trust port could still
be a caller-created JavaScript object. Run 226 removes that structural trust
shortcut. The attestation verifier now accepts only the runtime capability
created by createHoidNativeSecurityProviderTrustRegistryPort().

## Trust chain

1. The application build pins a trust-domain identifier, root key identifier,
   root Ed25519 public key, application identifier and minimum registry revision.
2. A registry source returns a complete canonical JSON document.
3. The registry document is verified with the pinned root public key. The
   document cannot supply or replace its own trust anchor.
4. A durable rollback-resistant revision witness supplies the current minimum
   revision. Older signed registries are rejected.
5. A newer root-signed revision advances the floor with atomic compare-and-set
   and is re-read before it is accepted.
6. Provider-key lookup is exact across provider ID, platform, application ID
   and the key ID carried by the native attestation.
7. Only entries in active state are returned. A revoked entry is never
   returned as a pinned provider key.

## Registry schema v1

The canonical JSON document contains exactly:

- schemaVersion
- kind
- trustDomainId
- rootKeyId
- revision
- providerKeys
- signatureHex

Each provider-key entry contains exactly:

- keyId
- providerId
- platform
- appIdentifier
- publicKeyHex
- state (active or revoked)

Entries must be sorted by provider ID, platform, application ID and key ID.
Key IDs are unique in the trust domain. The complete document must already be
in canonical JSON form; duplicate properties, alternate key ordering,
whitespace variants, extra fields, sparse arrays and malformed key material
are rejected.

The root signature covers a fixed domain-separated tuple and every provider
entry. The private root signing key is never included in the app or repository.
buildHoidNativeSecurityTrustRegistrySigningMessage() is a publisher-side
canonicalization helper; it does not sign anything.

## Anti-rollback contract

The host supplies HoidNativeSecurityTrustRegistryRevisionPort.

Its readMinimumRevision() must return an already initialized positive integer.
A missing floor is a hard failure; the adapter never bootstraps trust state from
the registry it is trying to verify.

compareAndSetMinimumRevision() must be atomic, linearizable and durable for the
trust domain. It must be backed by a rollback-resistant native store or an
independently authenticated monotonic witness. Ordinary SQLite, AsyncStorage
or a value restored from the same application backup is not sufficient by
itself.

The adapter re-reads after every CAS attempt. It rejects a registry below the
observed floor, fails on invalid or unavailable witness state, and never
silently falls back to a local revision.

## Provider-key rotation and revocation

A registry update increments revision and is signed by the pinned root.

For a planned provider-key rotation, publish the new key as active, allow the
native provider to begin using its new key ID, and then publish a later
revision marking the old key revoked. Multiple active key IDs may coexist
during a controlled overlap; the attestation's exact key ID selects one entry.

A revoked key is rejected on the next attestation lookup. Existing process-local
security sessions remain bounded by their already-issued attestation expiry
(maximum 120 seconds); this run does not introduce immediate remote session
revocation. Root-key rotation is deliberately not self-authorized: it requires
an application release with a new out-of-band root pin.

## Runtime capability boundary

The registry factory registers its returned trust-port object in a private
WeakSet. The native attestation verifier rejects a structurally identical
object that was not created by this factory. The attestation lookup now includes
the exact provider signing keyId.

This protects the intended composition path against accidental or untrusted
dependency substitution. It is not a sandbox against arbitrary code execution
inside the same JavaScript process: the application must still construct the
root pin and revision witness only in its trusted composition root.

## Failure policy

- invalid root pin or provider port: construction fails;
- non-canonical or malformed registry: trust unavailable;
- invalid root signature: trust unavailable;
- missing/uninitialized revision floor: trust unavailable;
- registry revision below the floor: rollback rejected;
- CAS conflict: re-read and retry a bounded number of times;
- unavailable or non-durable revision witness: fail closed;
- missing or revoked provider key: no pinned key is returned;
- unbranded trust port: attestation request rejected before challenge use.

There is no unsigned, local-only, web or plaintext fallback.

## Verification

The new test suite covers root signatures, canonical JSON, exact key scoping,
revocation, revision advancement, rollback, CAS races, witness outages and
runtime port branding. The attestation and security-session suites now use a
root-signed registry fixture rather than a caller-created trust object.

The test root private key exists only in the deterministic test fixture. It
must never be reused for a production build. Production root public keys and
initial revision floors must be provisioned out of band.

## Remaining production requirements

This registry is a provider-neutral trust policy and adapter, not a native
Keychain/Android Keystore implementation. Production still requires:

- a reviewed native provider and protected provider signing key;
- an out-of-band application root public-key pin;
- a rollback-resistant native or independently witnessed revision store;
- real-device tests and independent security review;
- explicit root-key rotation through an application release.

No conversation persistence is activated. No EPUB bytes, XHTML, protected
passages, chapter text or unverified narrative summaries are added.
