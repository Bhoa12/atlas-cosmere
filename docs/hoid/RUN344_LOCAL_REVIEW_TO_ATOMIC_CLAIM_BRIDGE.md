# Run 344 — local editorial review to atomic-claim staging bridge

## Objective

Connect the Run 343 chapter-bound local review packet to the existing atomic editorial claim contract without treating a local approval as a trusted production review.

The bridge accepts exactly one original atomic statement at a time. It does not split a chapter summary automatically, infer facts, call an LLM, persist content or publish knowledge.

## Flow

1. Validate the source-bound historical editorial packet.
2. Validate its local review receipt against that exact packet.
3. Require the local decision to be `approved-awaiting-trusted-promotion`.
4. Resolve the packet's exact chapter against the edition-bound reading manifest.
5. Require the source document digest to match the sparse `verifiedChapterDocuments` claim corpus.
6. Build a normal `HoidEditorialClaimDraft` through `createHoidEditorialClaimDraft()`.
7. Build the existing independent atomic-claim review packet through `buildHoidEditorialClaimReviewPackets()`.
8. Return an ephemeral candidate at `awaiting-independent-claim-review`.

The generated claim uses the source chapter as its unlock threshold. The downstream cursor-native evaluator projects an open chapter N to completed-through N-1, so opening a chapter does not unlock claims sourced from that chapter.

## Reused contracts

This run deliberately reuses the established contracts rather than introducing a second claim schema:

- `historicalEditorialReview.ts` validates the local summary packet and untrusted local receipt.
- `readingManifest.ts` resolves the exact edition-bound chapter unit and locator.
- `verifiedChapterDocuments.ts` requires an individually inspected source document already present in the claim corpus.
- `editorialClaimDrafts.ts` validates the atomic statement, provenance and integrity digests.
- `editorialClaimReviewPackets.ts` creates the independent claim-level review packet.

A local approval is necessary for this bridge, but it is not sufficient for production. The resulting claim remains `pending-review`; a separate claim-level review and the existing signed complete-bundle promotion authority remain mandatory.

## Source and spoiler rules

- The bridge accepts one source chapter and one claim. It does not infer cross-book support.
- Cross-book or multi-chapter claims must use the existing atomic-claim contract directly with every source as a mandatory evidence requirement (logical AND).
- Duplicate/ambiguous chapter identities fail closed.
- A source digest absent from the sparse verified claim corpus is rejected, even if the local reinspection packet itself is valid.
- The unlock requirement is the exact source chapter, not the chapter currently open.
- The existing cursor-native evaluator must be used against authoritative progress before any claim can be considered eligible for review.
- Exact-unit spoiler dependencies and signed production claim authorization remain separate downstream gates.

## Ephemeral candidate

The candidate carries:

- deterministic candidate ID;
- local source-review packet ID;
- digest of the validated local review receipt;
- local-unverified trust label;
- one pending atomic claim draft;
- one pending independent claim-review packet.

It does not carry the chapter summary or source text. The claim statement is the separately authored original atomic assertion.

The candidate explicitly sets:

- `sourceSummaryIncluded: false`;
- `sourceTextIncluded: false`;
- `sourceTextPersisted: false`;
- `providerEgress: "none"`;
- `promotionAllowed: false`;
- `productionWritePerformed: false`;
- `authorizationEffect: "none"`;
- `spoilerAuthorization: "none"`.

SHA-256 binds the candidate to the packet, local receipt, claim digest and claim-review packet. It detects mutation; it does not authenticate the local reviewer.

## Limitations

- The bridge is a domain adapter and is not yet exposed as a new UI action.
- A local reviewer label remains unauthenticated.
- The bridge only works when the exact source chapter is already in the sparse verified claim corpus. Local-only historical receipts do not silently expand that corpus.
- The originality attestation remains human; no automated plagiarism detector is claimed.
- No production registry, reading progress, recommendation catalogue or provider context is modified.

## Validation

The dedicated workflow runs the bridge tests together with the existing local editorial packet, atomic claim draft and atomic claim review packet tests. It then performs strict TypeScript checking of the bridge and its test entrypoint.

## Source availability

No private EPUB is required to execute the bridge tests. The tests use synthetic statements and existing registered chapter digests solely as structural fixtures. They do not copy or assert narrative content. The private `cosmere.epub` and Roshar EPUB files were not present in the accessible Library search for this run; no new narrative material or summary has been produced.
