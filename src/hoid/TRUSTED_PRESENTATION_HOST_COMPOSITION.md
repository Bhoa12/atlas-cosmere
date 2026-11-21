# Trusted presentation host composition

## Purpose

`createHoidTrustedPresentationHost()` composes the existing trusted presenter with the native Ed25519 verifier, the signed remote monotonic trust-revision witness and a fresh host-owned cursor-progress refresh operation.

The composition root is provider-neutral. It does not contain a network URL, SDK, credential, signing key, reviewer registry, or production bootstrap.

## Required host-owned inputs

- `bootstrapPort`: reads a root-key configuration pinned out of band by the host.
- `trustRegistry`: root-signed, time-bounded reviewer registry.
- `witnessConfiguration`: witness ID, pinned witness public key and trust-domain ID, provisioned out of band.
- `witnessTransport`: authenticated transport to the remote witness service.
- `noncePort`: OS-CSPRNG source producing unique 256-bit hexadecimal nonces. `Math.random` is not acceptable.
- `clock`: trusted host clock returning canonical UTC timestamps.
- `progressRefreshPort`: host-owned operation that reloads the durable Atlas cursor ledger.
- `knowledge`, `signedClaims` and `context`: the exact local editorial bundle and its PR/HEAD-bound review context.
- `expectedRepositoryFullName`: repository scope fixed by the host.

The composition root creates `createHoidNobleEd25519VerificationPort()` itself. The verifier performs strict RFC 8032 verification and does not generate or store private keys.

## Progress adapter

`createHoidRefreshableTrustedReadingProgressPort()` accepts only a host object exposing a data-property `refresh()` method. On every final presentation it:

1. invokes the refresh operation;
2. awaits its result;
3. validates the complete v2 cursor snapshot against the reading manifests;
4. returns only the validated snapshot;
5. throws on storage failure, null, malformed or unsupported progress.

For Atlas, the intended binding is the `refreshHoidCursorProgressSnapshot` operation exposed by `CosmereContext`. That method calls `HoidCursorProgressCoordinator.refresh()`, which reloads the SQLite ledger instead of returning its in-memory cache. A cached `getSnapshot()`, React state, request payload or provider-supplied cursor must never be substituted.

## Remote monotonic witness

The host composition uses `createHoidRemoteTrustRegistryRevisionStorePort()`. Every read and compare-and-set is backed by a fresh nonce-bound Ed25519 receipt. The remote witness is the anti-rollback authority; a restorable local SQLite copy is not an acceptable fallback.

The transport and witness service remain separate ports. Production deployment still requires authenticated transport, durable linearizable server storage, durable replay protection and an isolated witness signing key (preferably KMS/HSM-backed). The client adapter does not claim that a service has been deployed.

## Fail-closed behavior

The host returns a blocked result when:
- any required host port is missing or accessor-backed;
- the progress refresh operation is unavailable;
- the witness adapter cannot be constructed;
- bootstrap, trust registry, witness receipt, reviewer signature or revision persistence fails;
- the signed claim set is empty or invalid.

The returned presenter reconstructs answer text and citations from local approved claims. Provider text is never rendered by this composition root.

## UI integration status

This run adds the composition boundary and end-to-end tests. It does not connect the presenter to `HoidScreen`, because the repository currently has no production root bootstrap, reviewer registry, remote witness transport, OS-CSPRNG nonce adapter or signed approved-claim bundle. The production editorial registry is empty. The UI must remain closed to narrative answer rendering until those real host inputs exist and the screen is explicitly wired to render only the trusted presenter's `status: "ready"` result.

No test key, test registry, synthetic claim, or fixture progress may be provisioned in the application.

## Privacy and spoilers

The progress port carries only the validated local cursor snapshot. The remote witness receives only trust-domain IDs, operation metadata, nonces and revision numbers; it receives no book, chapter, character, evidence, EPUB, XHTML or narrative text. The trusted presenter continues to enforce each evidence source's independent N+1 unlock boundary.

No EPUB bytes, XHTML, copied passages, extracted text, images or private file paths belong in this module or its tests.
