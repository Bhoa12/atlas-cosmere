# Run 197 — Real Ed25519 verification in trusted presentation tests

## Objective

Close the test-only cryptographic gap in Run 196. The repository already contains the production-facing `createHoidNobleEd25519VerificationPort` adapter and standalone RFC 8032 tests. However, the end-to-end `createHoidTrustedVerifiedAnswerPresenter` suite still supplied a hash-shaped fake verifier. That proved control flow, not Ed25519 integration.

## Changes

- Replace the fake verifier in `trustedVerifiedAnswerPresentation.test.ts` with `createHoidNobleEd25519VerificationPort`.
- Generate deterministic root and reviewer keypairs inside the test fixture using test-only seeds.
- Sign the canonical trust-registry payload with the test root seed.
- Sign the exact PR/review-bound approved-claim payload with the test reviewer seed.
- Keep the existing negative cases for altered signatures, replayed PR context, invalid root signatures, revision rollback, expiry, stale presenters, N+1 unlocks, forged caller progress and progress-store failure.
- Extend `hoid-native-ed25519-trusted-host.yml` to run the end-to-end trusted presenter test and type-check its implementation.
- Document that test seeds are public fixtures and must never be provisioned or reused for production approvals.

## Security properties exercised

The integration test now exercises the actual Noble Ed25519 verification adapter through both signature layers: root authentication of the reviewer registry and reviewer authentication of the approved claim. The standalone adapter test continues to cover the RFC 8032 known-answer vector, strict non-ZIP-215 verification, malformed encodings, accessor rejection, Unicode UTF-8 and fail-closed encoding.

## Boundaries

- No production private key, root key, reviewer credential or bootstrap configuration is created.
- No production trust registry is provisioned.
- No claim is approved or promoted.
- No app screen is wired to a synthetic trust configuration.
- No progress state is changed.
- No EPUB, XHTML, passage, extracted source text, image or private path is committed.
- The cryptographic adapter remains provider-independent and uses the existing pinned `@noble/curves` dependency.

## Validation

The updated native Ed25519 workflow is required to run:
- `nobleEd25519VerificationAdapter.test.ts`
- `trustedVerifiedAnswerPresentation.test.ts`
- trusted bootstrap, promotion and revision-store suites
- strict TypeScript checks for the Noble adapter and trusted presenter.

This report does not claim a passing result until GitHub Actions completes on the final branch HEAD.

## Isolation

Base: `feat/hoid-ia-core-run196` at `99b6a3a8d700044fbf4dfca3df81f4d355b9d48f`.

The work is isolated to `feat/hoid-ia-core-run197`. No changes are made to `main`, PR #89, Run 196 or earlier branches. No merge is performed.
