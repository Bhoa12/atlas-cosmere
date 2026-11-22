# Run 224 — Signed native conversation-security provider attestation

## Purpose

Run 223 evaluates a provider's declared security capabilities. That result is
useful as a fail-closed configuration check, but a JavaScript object supplied by
the composition root is not evidence that the declared provider is the one
actually installed.

Run 224 adds a challenge-response attestation protocol. The native provider
returns a short-lived Ed25519-signed statement that binds its capability
declaration to the application identifier, exact native build, platform and a
fresh one-use challenge.

The verifier uses the existing strict Ed25519 verification adapter directly.
The verification primitive is not supplied as a request dependency, so a
caller cannot replace signature verification with an arbitrary callback.

## Protocol

1. The host challenge store issues a fresh 256-bit challenge using a CSPRNG.
2. The native provider signs a statement containing that challenge, its
   provider identity, platform, application identifier, build identifier,
   timestamps and canonical JSON capabilities.
3. The verifier consumes the challenge atomically. A challenge can be used
   only once, including when the returned statement is malformed.
4. The host reads the provider public key from a separately pinned trust port.
   The public key is never accepted from the attestation itself.
5. The Ed25519 signature is verified over a fixed-order JSON tuple.
6. The capability JSON must already be canonical: parsing and re-serializing
   it must produce the exact same bytes. Duplicate JSON properties and
   alternative encodings are rejected.
7. The signed capabilities are passed to the Run 223 readiness evaluator.
   A successful signature cannot override a blocked platform, storage, AEAD,
   nonce or SQLite requirement.

## Attestation fields

The version-1 statement binds:

- schema version and kind;
- pinned key identifier;
- provider identifier and native platform;
- application bundle/package identifier;
- exact application build identifier;
- one-use 256-bit challenge;
- canonical issue and expiry timestamps;
- canonical JSON capability declaration.

The signature uses Ed25519 and lowercase hexadecimal encoding. Attestations
must be current, no older than two minutes and have a lifetime no longer than
two minutes. The one-use challenge is the primary replay defence; timestamps
are an additional freshness constraint.

## Trust and failure policy

The pinned provider key is supplied by a host trust port, provisioned outside
the attestation response. It must be scoped to the provider, platform and
application identifier. Missing or mismatched trust material blocks readiness.

All failures return stable blocked reasons. Native provider exceptions,
trust-store exceptions, invalid signatures, stale statements, challenge replay,
capability mismatch and readiness failures never fall back to an unsigned
capability object.

The challenge is consumed after the native response is received and also
when the native request fails. This prevents a failed attempt from leaving a
reusable challenge in the pending store.

## Important security limitation

This is signed provider attestation, not hardware attestation or remote
platform attestation. A valid signature proves that the holder of the pinned
provider signing key signed the statement. It does not independently prove
that a key is hardware-backed, non-exportable, that the provider binary is
untampered, or that nonce uniqueness is correctly implemented.

Before production activation, the pinned key must be provisioned out of band,
the native signing key must be protected by a reviewed platform mechanism, and
the iOS and Android implementations must pass independent review and
real-device conformance tests. The application must not ship a development
private key or trust a key returned by the provider.

## Verification

The test suite uses a deterministic Ed25519 test key only. It verifies
challenge consumption, replay rejection, app/build/platform binding, key
pinning, signature failure, timestamp windows, canonical capability JSON,
Run 223 readiness integration and fail-closed handling of malformed ports.

No native provider, private signing key, conversation key, EPUB content,
XHTML, protected passage or narrative claim is added by this run. Conversation
persistence remains inactive until reviewed native providers are integrated.
