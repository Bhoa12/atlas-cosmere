# Hoid IA — Run 317: independent whole-bundle editorial quorum

## Purpose

Run 317 adds a second-stage editorial sign-off over the complete promotion
candidate. It complements the existing per-packet review receipts and the
protected GitHub review process; it does not replace either one.

The existing review pipeline checks every summary, atomic claim, entity and
relationship packet, including its factual, provenance and spoiler-ceiling
checklist. The new quorum adds an independent cross-bundle decision after that
packet-level review is complete.

## Review flow

1. Rebuild the promotion plan from the exact review manifest, knowledge
   manifest, four source batches, complete receipt set and authoritative
   progress snapshot.
2. Require the supplied promotion plan to match the rebuilt plan byte-for-byte
   after canonical validation.
3. Require the review context to match the plan's review-bundle fingerprint and
   promotion-plan fingerprint, as well as the exact PR base/head refs and SHAs.
4. Build a domain-separated Ed25519 signing message containing:
   - repository and Pull Request number;
   - base and head refs and commit SHAs;
   - promotion manifest path;
   - promotion-plan and review-bundle fingerprints;
   - knowledge-bundle and receipt fingerprints;
   - progress revision and progress fingerprint;
   - reviewer ID, decision, review timestamp and key ID.
5. Require two to eight distinct reviewer IDs and distinct key IDs, in
   deterministic reviewer-ID order.
6. Verify every signature through the existing root-authenticated reviewer
   registry, including registry revision, key status, validity interval and
   repository authorization.
7. Return a verified whole-bundle quorum or an authenticated rejection.

## Security properties

- A reviewer cannot sign only a subset of the plan and have it count as a
  whole-bundle approval.
- A changed packet receipt, source inventory, progress snapshot, promotion
  plan, PR head, reviewer decision or signing key changes the signed message.
- Two keys assigned to the same reviewer do not count as two reviewers.
- Expired, revoked, repository-unauthorized or untrusted reviewer keys fail.
- Incomplete or revision-required packet receipts block the quorum before
  cryptographic verification.
- Accessor-backed objects, sparse arrays, duplicate identities and malformed
  signatures fail closed.
- The result contains fingerprints and reviewer IDs only; it does not expose
  staged summaries, claim prose or source passages.
- The module never writes to the production editorial registry.

## Explicit non-promotion boundary

A verified quorum means only that the supplied reviewers signed the exact
reviewed promotion plan under the supplied root-authenticated registry. It
does not independently re-inspect a source passage, does not establish
hardware attestation, and does not authorize production writes.

Every result keeps:

- `promotionAllowed: false`
- `productionWritePerformed: false`

The existing protected-review and progress-freshness authority remains a
separate mandatory gate. Production promotion remains a separate operation
requiring the trusted runtime, monotonic checkpoint and explicit deployment
authority.

## Copyright and source availability

The signed message contains only plan fingerprints and review metadata. The
bundle contains record IDs, digests and edition-bound chapter locators. This
run does not add EPUB bytes, XHTML, extracted text, copied passages, chapter
summaries or private file paths.

The current Library lookup did not locate the named private EPUB files in the
available Library listing. Therefore this run does not claim to have inspected
new chapters or to have expanded the verified chapter-document allowlist.
Existing staged editorial material remains pending its real human review and
production trust provisioning.

## Validation

The existing complete editorial review workflow is extended to run:

- whole-bundle quorum tests;
- existing signed reviewer trust tests;
- existing complete knowledge/review bundle tests;
- existing signed promotion regression tests;
- strict TypeScript checks for the new boundary.

The test verifier is synthetic and exists only to exercise the contract. It is
not a production key, trust root or deployable signing identity.
