# Run 288 — exact-unit claim attestation v2

## Objective

Remove the remaining numeric chapter-label dependency from editorial claim review and allow a single evidence record to declare prerequisites across multiple works without inventing cross-book chronology.

This run adds a versioned boundary alongside the existing v1 formats. It does not silently reinterpret or migrate v1 records.

## Exact-unit policy v2

`HoidExactUnitEvidencePolicy` binds three edition-revalidated `HoidChapterReference` values:

- `source`: the unit containing the reviewed evidence;
- `firstSafeAppearance`: the exact unit after which the entity/concept may be discussed;
- `unlock`: the exact unit that completes the editorial release threshold.

Each reference includes book identity, visible chapter label, ordinal, unit ID, ambiguity flag and edition identity fingerprint. Duplicate chapter labels remain distinct.

The three references may belong to different works. Ordinals are compared only when two references belong to the same work. The unlock cannot precede a source or first-safe unit in that same work.

## Authorization rule

The v2 authorizer requires all three referenced units to be complete:

1. The source unit must be in the verified completed prefix of its work.
2. The first-safe-appearance unit must be in the verified completed prefix of its work.
3. The unlock unit must be in the verified completed prefix of its work.

An explicitly completed work satisfies references in that work. An open cursor at ordinal N proves only the prefix through N-1. A missing work, invalid snapshot, stale reference or unavailable durable store fails closed.

For a cross-work policy, no chronological ordering is inferred between books. All three prerequisites must independently be completed.

## Claim attestation schema v2

`createHoidExactApprovedClaimAttestation()` and `validateHoidExactApprovedClaimAttestation()` bind:

- the canonical original claim statement and intent;
- the exact set of evidence IDs;
- each exact policy reference, including unit IDs and identity fingerprints;
- evidence kind, aliases, verified provenance and an SHA-256 of the original editorial summary;
- an inspected source-document SHA-256;
- reviewer identity and canonical review timestamp.

The v2 integrity digest is separate from the legacy numeric v1 attestation. A v1 claim cannot be treated as v2 without a new editorial review.

## Source-document verification

The current verified-body allowlist is indexed by unambiguous chapter labels. Therefore the source reference must be unambiguous and its individual chapter-body digest must be present in the allowlist.

An exact duplicate-label reference may be used for first-safe-appearance or unlock policy fields. It cannot yet be attested as the source body unless an exact-unit body digest is added after that private EPUB document is actually inspected.

This is intentional: a navigation locator proves structure, not that the chapter body was read or reviewed.

## Provider boundary

These contracts are local and provider-neutral. No progress snapshot, chapter reference, unit ID, edition fingerprint, EPUB locator, source passage or private chapter body is sent to an AI provider.

The attestation stores hashes and original editorial summaries only. It does not copy or upload EPUB/XHTML text.

## Integration status

This run adds the v2 authorization and review contracts in parallel with v1. It does not yet replace `HoidUnitEvidenceRuntime` or `HoidConversationGateway`.

The next integration must:
- accept only v2 claims and policies for exact-unit requests;
- use the v2 authorizer before selector invocation;
- reauthorize all three prerequisites after asynchronous provider work and before presentation;
- keep v1 behavior isolated until an explicit migration/review is completed.

No production authority switch is performed here.

## Tests

The new suites cover cross-work prerequisites, open-cursor blocking, exact duplicate-label identities, same-work ordinal ordering, explicit completion, stale references, accessor-backed input rejection, exact claim/policy binding, source-body digest requirements, summary tampering and legacy compatibility boundaries.

All fixtures use synthetic metadata and original test summaries. No private EPUB content is included.
