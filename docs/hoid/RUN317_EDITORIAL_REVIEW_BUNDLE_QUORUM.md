# Hoid IA — Run 317: signed editorial bundle review quorum

## Purpose

Run 317 adds a bundle-level review boundary on top of the existing source-bound
editorial drafts and root-signed reviewer trust registry.

The earlier review-signature contract authenticates an individual review payload.
This run adds a domain-specific wrapper that verifies the complete metadata-only
knowledge bundle, binds every reviewer decision to the exact bundle fingerprint
and Pull Request head, and requires at least two distinct reviewers.

## Review flow

1. Rebuild and validate the supplied summary, atomic-claim, entity and
   relationship staging batches against the supplied bundle manifest.
2. Require the bundle status to be `ready-for-review`; a blocked bundle cannot
   receive a successful quorum.
3. Require the review context's `reviewBundleFingerprint` to equal the rebuilt
   bundle fingerprint.
4. Build a domain-separated Ed25519 signing message containing:
   - repository and Pull Request number;
   - base and head refs and commit SHAs;
   - promotion manifest path and plan fingerprint;
   - exact bundle fingerprint;
   - reviewer ID, decision, review timestamp and key ID.
5. Require two to eight distinct reviewer IDs and distinct key IDs, in
   deterministic reviewer-ID order.
6. Verify every signature through the existing root-authenticated reviewer
   registry, including registry revision, key status, validity interval and
   repository authorization.
7. Return either a verified approval quorum or an authenticated rejection.

## Security properties

- A signature from one reviewer cannot satisfy the quorum.
- Two keys assigned to the same reviewer do not count as two reviewers.
- A changed bundle, source inventory, PR head, promotion plan or reviewer
  decision changes the signed message.
- Expired, revoked, repository-unauthorized or untrusted reviewer keys fail.
- Accessor-backed objects, sparse arrays, duplicate identities and malformed
  signatures fail closed.
- The result contains fingerprints and reviewer IDs only; it does not expose
  staged summaries, claim prose or source passages.
- The module never writes to the production editorial registry.

## Explicit non-promotion boundary

A verified quorum means only that the supplied reviewers signed the exact
review packet under the supplied root-authenticated registry. It does not
prove that private EPUBs are currently available, does not independently
re-inspect a source passage, does not establish hardware attestation, and does
not authorize production writes.

Every result keeps:

- `promotionAllowed: false`
- `productionWritePerformed: false`

Production promotion remains a separate operation requiring its own
reviewed manifest, trusted runtime, monotonic checkpoint and explicit
deployment authority.

## Copyright and source availability

The bundle contains only record IDs, digests and edition-bound chapter
locators. This run does not add EPUB bytes, XHTML, extracted text, copied
passages, chapter summaries or private file paths.

The current Library lookup did not locate the named private EPUB files in the
available Library listing. Therefore this run does not claim to have inspected
new chapters or to have expanded the verified chapter-document allowlist.
Existing staged editorial material remains pending review.

## Validation

The dedicated workflow runs:

- bundle quorum tests;
- existing editorial review signature tests;
- existing complete knowledge bundle tests;
- strict TypeScript checks for the new boundary.

The test verifier is synthetic and exists only to exercise the contract. It is
not a production key, trust root or deployable signing identity.
