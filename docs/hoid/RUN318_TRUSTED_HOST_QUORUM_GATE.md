# Hoid IA — Run 318: trusted-host editorial quorum gate

## Purpose

Run 318 makes the whole-bundle editorial quorum a mandatory gate in the
trusted-host promotion composition. A valid packet-signature batch and a
protected GitHub review are no longer sufficient at the host boundary unless
the exact promotion plan also has a verified two-reviewer bundle quorum.

The lower-level packet-signature verifier remains a reusable primitive. The
application-facing composition is
\`authorizeHoidTrustedHostSignedEditorialBundlePromotion()\`; it now requires
\`bundleReviewAttestations\` and verifies them before invoking the
revision-bound signed-promotion authority.

## Required order

1. Load the host-pinned bootstrap and verify the expected repository.
2. Read the durable minimum trust-registry revision.
3. Reconstruct the quorum context from own data properties of the exact
   promotion request, plan fingerprints and editorial bundle.
4. Verify the whole-bundle attestations against the root-authenticated
   reviewer registry and persisted minimum revision.
5. Reject timeout, unavailable verifier, invalid attestation, authenticated
   rejection, mismatched plan/progress/PR context or malformed reviewer set.
6. Only after quorum success, invoke the existing revision-bound packet
   signature and protected-review pipeline.
7. The existing pipeline persists/rechecks the trust-registry revision,
   verifies every packet signature, verifies protected GitHub review, and
   refreshes authoritative progress before and after the asynchronous review.

The quorum is bound to repository, PR number, base/head refs and SHAs,
promotion manifest path, plan and review fingerprints, receipts, progress
revision and progress fingerprint. The host derives those context fields from
the same request later consumed by the packet-signature and protected-review
pipeline; a caller cannot supply a separate quorum target.

## Failure behavior

- Missing or malformed quorum input blocks before packet-signature checks,
  GitHub review fetches, or live progress reads.
- A signed reviewer rejection is a hard block.
- Quorum verification has a 15-second deadline; timeout and verifier failure
  fail closed.
- The result is revalidated for two to eight distinct, canonically ordered
  reviewer IDs and exact plan/progress fingerprints before delegation.
- No fallback to the old host path exists.

## Safety and production boundary

The verified quorum is an additional editorial authorization, not a source
inspection and not a deployment authorization. Every result retains
\`promotionAllowed: false\` and \`productionWritePerformed: false\`. The
pipeline never writes the production editorial registry and never merges a
Pull Request.

The trusted host continues to supply the pinned root key, trust domain,
cryptographic verifier and durable revision store. Tests use synthetic or
test-only keys; no production private keys or roots are added.

## Spoilers and source privacy

This run does not alter chapter unlock policy, progress semantics, evidence
scope, or the spoiler ceiling. Bundle review attestations bind the exact
reviewed editorial package and the same progress snapshot as the promotion
plan. A progress change invalidates the quorum and the subsequent promotion
check.

No EPUB bytes, XHTML, extracted passages, private paths or copied prose are
added. The supplied bibliography remains a metadata catalogue; no new chapter
is claimed as inspected by this run.

## Validation

The dedicated workflow runs:
- whole-bundle quorum tests;
- trusted-host composition tests;
- real-Ed25519 host promotion dry-run tests;
- revision-store and packet-signature regressions;
- strict TypeScript checks across the promotion boundary.
