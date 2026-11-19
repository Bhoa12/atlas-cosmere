# Hoid editorial integrity and review packets

## Purpose

Run 104 binds each original editorial summary to its own UTF-8 SHA-256 digest and adds a deterministic review-packet workflow. This closes a gap in the previous pipeline: the source chapter was fingerprinted, but a summary could be edited while retaining the same source-document digest.

## Summary integrity

`sha256.ts` implements dependency-free SHA-256 so the core remains usable in React Native and Node without an SDK-specific crypto dependency.

Every pending draft now contains `summaryIntegrity.sha256`. Validation recomputes the digest from the normalized original summary and rejects any mismatch. The digest is not a claim that the summary is factually correct; it only proves that the reviewed text is the exact text represented by the packet.

## Review packets

`buildHoidEditorialReviewPackets()` converts a fully validated draft batch into deterministic packets sorted by draft ID. Each packet contains:

- the original editorial summary;
- summary and source-document SHA-256 digests;
- edition, navigation digest, chapter and opaque locator;
- the independent unlock threshold;
- an unchecked review checklist.

It never includes EPUB bytes, XHTML, copied passages or extracted source text.

## Review receipt

`validateHoidEditorialReviewReceipt()` binds a receipt to the packet ID, draft ID, summary digest and source-document digest. The checklist covers factual accuracy, completeness, originality, spoiler ceiling and provenance. Receipts use a closed set of issue codes instead of free-form notes, preventing private source passages from being pasted into review metadata. An `approved` decision is rejected unless every criterion is true.

The packet ID is a SHA-256 fingerprint over the draft ID, summary digest, source-document digest, edition, navigation digest, exact chapter locator and unlock threshold. Receipt validation rechecks the chapter locator and source-document digest against the current verified manifest allowlist. A structurally valid approval returns `approved-awaiting-source-promotion`, with `promotionAllowed: false`. It does not modify `editorialRegistry.ts`, does not create an approved claim and does not make a draft visible to a provider.

Reviewer identity is not authenticated by this TypeScript contract. The identity and independence of the reviewer must be established by the protected GitHub pull-request review and repository permissions. Do not treat a locally constructed receipt as proof of a human review.

## Production boundary

- All three existing drafts remain `pending-review`.
- The production registry remains empty.
- The strict evidence runtime continues to abstain when no approved claim exists.
- Promotion requires a separate source-controlled change that adds reviewed knowledge and claims, followed by the existing evidence and spoiler tests.
- No private EPUB or chapter text is committed.

## Validation

Run:

```sh
npx vitest run src/hoid/sha256.test.ts src/hoid/editorialDrafts.test.ts src/hoid/editorialReviewPackets.test.ts src/hoid/verifiedChapterDocuments.test.ts src/hoid/editorialRegistry.test.ts src/hoid/evidenceScope.test.ts src/hoid/readingManifest.test.ts
```

Then run the strict TypeScript check in `.github/workflows/hoid-editorial-draft-validation.yml`.

## Copyright and provenance

Only original editorial prose, bibliographic metadata, opaque locators and cryptographic digests may be committed. If a source passage is unavailable, no summary or fact may be invented and no claim of source inspection may be made.


## Run 169 — completed-through evidence threshold

Review-packet unlock chapters use the completed-through coordinate system. A source in chapter N may use unlock chapter N; the summary is available when the v2 cursor advances to N+1. Unlock values earlier than the cited source remain invalid; later values are allowed for a stricter ceiling.
