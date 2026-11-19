# Run 160 — provider-neutral remote trust witness service

## Purpose

Run 159 introduced the client adapter for signed remote monotonic trust receipts. This run adds the server-side protocol handler that issues those receipts, while keeping HTTP, authentication middleware, durable storage and private-key management outside the Hoid core.

The service handler is a composition boundary, not a deployed network service. A production deployment must supply the ports below and expose the handler through a separately reviewed transport adapter.

## Server contracts

\`remoteTrustRevisionWitnessService.ts\` defines:

- \`HoidTrustRevisionWitnessServerStorePort\`: durable revision reads and atomic compare-and-set;
- \`HoidTrustRevisionWitnessClientAuthorizationPort\`: operation-level authorization for an authenticated client;
- \`HoidTrustRevisionWitnessReplayProtectionPort\`: durable, atomic one-time nonce claims;
- \`HoidTrustRevisionWitnessSigningPort\`: signing through an external key manager or HSM;
- \`HoidTrustRevisionWitnessServerClockPort\`: trusted canonical UTC time.

The factory validates exact configuration and dependency shapes. It does not import an HTTP framework, database SDK, cloud SDK, key-management SDK or network client.

## Request boundary

The handler accepts only the two schema-v1 request shapes already emitted by the Run 159 client:

- read minimum revision;
- compare-and-set minimum revision.

Requests are exact records. Unknown fields, accessors, malformed identifiers, nonces, trust domains, revisions and witness IDs are rejected.

The authenticated client ID is a separate argument obtained from trusted transport middleware. A client ID inside request JSON is not accepted. The transport adapter must authenticate the caller before invoking the handler.

## Authorization and replay sequence

1. Validate the exact request against the host-pinned witness configuration.
2. Validate the authenticated client identity supplied by middleware.
3. Read and validate the trusted clock.
4. Ask the authorization port whether this client may perform this operation in this trust domain.
5. Atomically claim the client/domain/nonce tuple in the replay-protection store.
6. Read or compare-and-set the durable monotonic revision.
7. Validate the store's result against the requested operation.
8. Build the canonical receipt and sign it through the injected signing port.
9. Return the signed receipt only if the signer returns a canonical 64-byte Ed25519 signature.

Authorization occurs before replay storage and revision storage. A denied caller cannot consume a nonce or probe the revision store.

## Atomic compare-and-set semantics

The server store must return an exact result containing an outcome and the revision observed inside the same transaction:

- \`advanced\`: the expected revision was atomically replaced by the target revision;
- \`already-applied\`: the target revision is already current, making a retry idempotent;
- \`conflict\`: a different newer revision won the race.

The handler rejects inconsistent results. Successful outcomes must observe exactly the requested target. A conflict must observe a revision greater than the expected value and different from the requested target.

The store implementation must guarantee durable, linearizable CAS for each trust domain. An in-memory map or a read-then-write sequence without a transaction is not sufficient for production.

## Replay protection

The replay store must atomically claim the tuple:

\`(clientId, trustDomainId, requestNonceHex)\`

and retain it until the supplied expiry. The current service requests 120 seconds of retention. This exceeds the 30-second receipt lifetime and provides room for clock skew and transport retries.

The replay store must be shared across service instances and survive process restarts. A process-local Set is suitable only for unit tests.

## Signing and key custody

The service signs the canonical message using the pinned witness ID, key ID, trust domain, operation, nonce, expected/next revision, observed revision and receipt timestamps.

The private key is never passed into the Hoid module. A production signing port should invoke a KMS/HSM or equivalent isolated signer and return lowercase 128-character hexadecimal Ed25519 signatures. The client independently verifies the receipt against its out-of-band pinned public key.

Key rotation requires a separately reviewed protocol/configuration change; the handler does not silently select a key from request data.

## Failure behavior

The handler fails closed on:

- unauthenticated or unauthorized clients;
- replay or unavailable replay protection;
- unavailable or malformed durable storage;
- inconsistent CAS results;
- unavailable or malformed signing;
- invalid clock values;
- malformed requests.

It never fabricates a revision, signs an unvalidated store result, falls back to local-restorable state or exposes private signing material.

## Verification

The dedicated workflow runs the server protocol tests together with the Run 159 client protocol and monotonic-store regression tests, then type-checks both sides under strict TypeScript.

Tests use deterministic synthetic keys and an in-memory atomic fixture. They prove the handler contract and concurrency semantics, not a deployed database, authentication service, HSM or remote endpoint.

## Production release gates

Still required before deployment:

- a real authenticated transport adapter;
- client identity issuance and revocation;
- a durable transactional revision store;
- a durable cross-instance replay-protection store;
- a KMS/HSM-backed signing adapter and key-rotation procedure;
- service monitoring, rate limits, backup/restore controls and incident response;
- integration tests against the selected infrastructure.

No EPUB, XHTML, chapter text, reading progress, claim, evidence or narrative data is sent to this service. The protocol carries trust-domain and revision metadata only.
