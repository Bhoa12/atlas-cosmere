# Run 225 — verified conversation-security session gate

## Purpose

Run 224 verifies a short-lived, one-use, provider-signed native security statement. A plain
{ status: "verified" } result is still ordinary JavaScript data and can be copied or reconstructed
by a caller. Run 225 turns successful verification into a process-local capability whose identity
is held in a module-private WeakMap.

The session is not serializable, cannot be recreated from its visible shape, and is bound to the
application identifier, exact build identifier, platform and attestation expiry.

## Establishment

createHoidConversationSecuritySession():

1. validates an exact, accessor-free host request;
2. obtains the current wall-clock timestamp inside the module;
3. invokes the Run 224 challenge-response verifier;
4. rejects every blocked verification result;
5. creates an empty frozen object and records its authorization data in a private WeakMap;
6. returns the capability and non-secret verification metadata.

The caller cannot provide the verification timestamp or a replacement signature verifier.
The host must still construct the challenge, attestation and pinned-trust ports from its trusted
native composition root. A JavaScript caller that controls the trust port can control the trust
anchor; this module does not manufacture trust out of dependency injection.

## Session checks

Every check validates:

- object identity against the private WeakMap;
- expiration against both the current wall clock and a monotonic process clock;
- exact app identifier;
- exact app build identifier;
- exact native platform.

The session expires no later than the signed attestation expiry (Run 224 limits that statement
to two minutes). revokeHoidConversationSecuritySession() removes it from the WeakMap.
A revoked or expired token is rejected on every subsequent operation.

The session exists only in process memory. It is not written to SQLite, AsyncStorage, backups,
conversation snapshots or provider context. Process restart invalidates every outstanding token.

A missing, invalid or backwards-moving monotonic clock blocks or expires the session. The monotonic elapsed-time limit prevents moving the device wall clock backwards from extending an already issued session. Moving the wall clock forwards may expire a session early, which is an intentional fail-closed outcome.

## Storage wrappers

saveHoidConversationHistoryWithSecuritySession() checks the session and host runtime identity
before delegating to the existing progress-bound snapshot validation and compare-and-swap path.

loadHoidConversationHistoryWithSecuritySession() checks before I/O and again after the
asynchronous read. If the session expires or is revoked while SQLite is reading, the loaded
messages are discarded and are not returned to the UI.

The wrappers preserve the existing book/chapter progress scope. A valid security session does
not authorize a spoiler, change a progress fingerprint, or bypass snapshot hydration.

### Important boundary

This gate does not certify an arbitrary HoidConversationHistoryStorePort. The host must pass
only the concrete encrypted Expo SQLite adapter constructed with the reviewed AEAD protector
and key manager. The session gate controls when that host-owned store may be used; it does not
prove that an injected store encrypts data.

A save that has already entered its compare-and-swap operation is not cancelled by later session
revocation. Its payload remains subject to the encrypted-store requirement. Revocation blocks
subsequent operations. The host must treat an uncertain storage error as requiring a fresh read
of the storage revision before retrying.

## Fail-closed outcomes

- malformed request: no session;
- failed signature, challenge, trust or readiness: no session;
- forged/copied token: blocked;
- expired token: blocked and removed;
- app/build/platform mismatch: blocked;
- revoked token: blocked;
- expired session during load: loaded messages discarded;
- unavailable storage: existing storage result remains unavailable.

There is no unsigned, development, web or plaintext fallback.

## Production limitations

Run 225 is a host-side session gate, not a native implementation. The repository still needs:

- reviewed iOS Keychain and Android Keystore modules;
- a native AEAD implementation and nonce-generation conformance tests;
- out-of-band provider signing-key provisioning and rotation;
- real-device tests and independent security review;
- a composition-root integration that exposes only the gated storage operations.

No conversation persistence is activated by this run. CosmereContext and HoidScreen are not
wired to the new gate. This is deliberate: there is no reviewed native provider to establish a
real session yet.

## Spoiler and source guarantees

The gate does not change the reading ledger, book/chapter unlock thresholds, editorial registry,
or source catalog. Conversation loads still pass through hydrateHoidConversationHistorySnapshot
and the exact current progress scope. No EPUB bytes, XHTML, protected passages, chapter text or
unverified narrative summaries are added.
