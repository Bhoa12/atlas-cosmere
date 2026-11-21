# Run 198 — trusted presentation host composition

## Scope

Run 198 composes the Run 197 Noble Ed25519 verifier and signed remote trust-revision witness client with the existing Atlas cursor-progress coordinator.

## Implementation

- Added `trustedPresentationHostAdapters.ts` with a refresh-only adapter for the authoritative v2 cursor snapshot.
- Added `trustedPresentationHost.ts` as a provider-neutral composition root.
- The composition root constructs the real Noble Ed25519 verification port and the signed remote witness revision store, then builds `createHoidTrustedVerifiedAnswerPresenter()`.
- Added end-to-end tests using deterministic test-only root, reviewer and witness seeds. The test signs and verifies all three trust layers with real Ed25519.
- Added a dedicated GitHub Actions workflow for the composition, remote witness and cryptographic regression suites.
- Documented the required host ports and the remaining deployment gates.

## Security invariants

- Progress is obtained through a fresh host refresh operation on every presentation, not from a cached React snapshot or provider/request argument.
- The refresh result is revalidated against the v2 cursor ledger and edition manifests.
- The remote witness remains the monotonic anti-rollback authority; no local-restorable fallback is introduced.
- Root, reviewer and witness private keys exist only as deterministic test fixtures and are never provisioned by the app.
- Empty, unsigned or invalid editorial bundles remain blocked.
- The N+1 unlock boundary remains enforced by the trusted presenter.
- No production claim, reviewer approval, bootstrap, witness endpoint or credential is created.
- No EPUB, XHTML, passage, image, extracted text or private path is committed.

## Validation

The dedicated workflow is expected to run:
- `trustedPresentationHost.test.ts`;
- `trustedVerifiedAnswerPresentation.test.ts`;
- `remoteTrustRevisionWitness.test.ts`;
- `nobleEd25519VerificationAdapter.test.ts`;
- strict TypeScript checks for the composition and cryptographic boundaries.

The run must not be declared CI-complete until GitHub reports the workflow result for the final code/test HEAD.

## Remaining production work

The host still needs:
- an out-of-band root bootstrap provider;
- an authenticated remote witness transport and deployed service;
- a durable, cross-instance replay-protection store and isolated witness signer on the service;
- an OS-CSPRNG nonce adapter;
- an actual signed reviewer registry and signed approved-claim bundle;
- explicit UI wiring that renders only a ready result from the trusted presenter.

The current production editorial registry remains empty, so no narrative answer is enabled.
