# Hoid IA — Run 319: portable editorial review kit

## Purpose

Run 319 adds a bounded, portable JSON review kit for the existing editorial
bundle. It gives human reviewers one deterministic package containing the
validated original summaries, atomic claims, entity and relationship drafts,
their chapter-bound evidence metadata, individual review receipts, the
promotion-plan fingerprint and the exact Pull Request context.

The kit is a review artifact, not an authorization token and not a production
promotion. It cannot write the production knowledge registry.

## Contents

The kit contains:

- the metadata-only knowledge and review manifests;
- the four validated editorial draft batches and their generated review packets;
- the complete per-packet receipt set;
- the promotion plan and its progress revision/fingerprint;
- the exact repository, PR, base/head refs and SHAs;
- a deterministic spoiler-scope table for every packet/evidence item;
- the source-catalogue fingerprint.

The packet content is original editorial material (summaries, atomic
statements, entity dossiers and relationship statements). The kit does not
include EPUB bytes, XHTML, extracted source passages, chapter titles, private
file paths or raw source documents.

## Progress privacy and spoiler boundaries

The raw progress snapshot is consumed during kit construction but is not
exported. The kit discloses only the monotonic progress revision and
fingerprint already bound into the promotion plan.

For human review, spoilerScope lists each packet's source work/chapter,
edition/navigation/document fingerprints, locator ID and exact unlock ceiling.
Reviewers must check the packet's spoilerCeiling checklist item against this
scope. Cross-work evidence remains represented as separate source/unlock
tuples; the kit does not collapse them into a global maximum.

The exported kit is not a reading-progress authority. Before accepting any
signature, the trusted host must rebuild the promotion plan from the current
source batches, receipts and live progress snapshot. A changed progress
revision/fingerprint changes the plan fingerprint and invalidates the
attestation.

## Build, validate, serialize and parse

- buildHoidEditorialReviewKit() validates the knowledge manifest, rebuilds
  the four-category review bundle, requires a complete approved receipt set,
  builds the plan from the supplied progress snapshot and binds the PR context.
- validateHoidEditorialReviewKit() reconstructs the packet inventory,
  validates receipts, checks the plan's internal fingerprint and cross-binds
  it to the manifests, receipt digest, reviewer IDs, context and spoiler scope.
- serializeHoidEditorialReviewKit() serializes only a fully revalidated kit.
- parseHoidEditorialReviewKit() parses JSON and then runs the same full
  validation; parsing never grants trust.
- The portable JSON representation is bounded to 8,000,000 UTF-16 code units.

The kit fingerprint uses a domain-separated SHA-256 digest over the exact
ordered metadata and editorial payload. It is an integrity identifier, not a
signature.

## Offline reviewer signing

buildHoidEditorialBundleReviewSigningMessageFromPlan() creates the exact
domain-separated Ed25519 message from a validated plan, exact PR context,
reviewer ID, decision, timestamp and key ID. This permits an offline or
hardware-backed reviewer signer to operate without exporting the user's raw
progress ledger.

This helper validates the plan's internal fingerprint and context binding. It
does not independently prove that the plan is current. The trusted host
continues to rebuild the plan against live progress and verifies the resulting
attestations against its root-authenticated reviewer registry and persisted
minimum registry revision. No private key or production trust root is stored
in the repository or in the kit.

## Non-promotion boundary

Every kit and build/serialization result keeps:

- promotionAllowed: false
- productionWritePerformed: false

The kit does not bypass individual receipt review, the two-reviewer bundle
quorum, protected GitHub review, native trust provisioning or the trusted-host
promotion boundary.

## Source availability and copyright

The catalogue fingerprint covers bibliographic metadata only. It does not
prove that the private EPUB bytes are mounted or that a source passage was
consulted. Run 319 does not add chapter inspections or new narrative claims.
The kit exports validated original editorial drafts and chapter evidence
identifiers/digests only; it never exports source passages or EPUB bytes.
