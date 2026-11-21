# Run 210 — Evidence-runtime isolation for non-verified claims

## Finding

Run 209 intentionally strips narrative summaries from entries whose provenance is
`limited`, `unavailable`, or absent. The catalog therefore correctly retains
only metadata for those entries.

The strict evidence runtime canonicalizes the knowledge registry before it
revalidates claim attestations. A legacy claim that referenced a limited entry
still carried an attestation computed from the pre-canonical summary. Runtime
revalidation then returned `unverified-source`; the previous implementation
treated that one non-presentable claim as corruption of the entire registry
and returned no runtime at all.

This made one metadata-only claim disable unrelated claims backed by verified
evidence. It was fail-closed, but too coarse: the invalid claim should be
excluded, not allowed to deny service to the independent verified claim set.

## Change

`canonicalClaims()` now distinguishes source eligibility from integrity
failure:

- Claims whose evidence has been downgraded to name-only metadata and therefore
  returns `unverified-source` are omitted from the runtime's selectable claim
  set.
- Invalid claim shape, invalid review metadata, integrity mismatches, duplicate
  IDs, and malformed claim collections still reject the runtime configuration.
- Every raw claim ID is validated and reserved before source validation. A
  skipped metadata-only claim cannot shadow a later claim with the same ID.
- The original claim-attestation schema and fingerprint algorithm are
  unchanged. Verified claim fingerprints remain compatible.

The evidence runtime still obtains provider context only through the
reader-progress-aware catalog path. A skipped claim cannot be selected, and a
claim whose evidence is not fully verified cannot enter the candidate set.

## Catalog projection test

The catalog trust-boundary test now reflects the Run 209 contract:
`findMatches()` returns only the minimal identity projection. It verifies
that summaries, evidence watermarks, and first-safe-appearance metadata are
absent rather than attempting to mutate fields that the API no longer returns.
Mutation of the returned alias copy still cannot change the private catalog
snapshot.

## Validation targets

The relevant CI workflows exercise:

- evidence runtime and provider-selection boundaries;
- canonical knowledge kinds, including phenomenon;
- cursor/evidence authorization;
- catalog snapshot and summary-disclosure boundaries;
- source coverage and strict TypeScript.

## Privacy and scope

No EPUB, XHTML, source passage, image, or full-text content is added. No
reading progress, edition manifest, editorial approval, topic assignment,
activation receipt, or production credential is changed. This run only
corrects runtime eligibility and test expectations for metadata-only claims.
