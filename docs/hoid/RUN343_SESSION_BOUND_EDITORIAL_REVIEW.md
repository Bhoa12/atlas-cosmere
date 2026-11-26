# Run 343 — session-bound local editorial review packets

## Objective

Turn the ephemeral chapter summary from Run 342 into a deterministic, source-bound review packet and an explicitly local human-review decision. This is a staging boundary only; it is not the trusted production promotion protocol.

## Source binding

The session controller now validates the historical inspection receipt itself before calling the reinspection port. A successful handoff retains, in private session memory, only:

- the receipt fingerprint;
- the inspected document SHA-256;
- the edition navigation SHA-256;
- byte length;
- inspection timestamp.

The evidence is not placed on the public handoff or draft object. It is used only when the controller builds a review packet. The packet identifies the exact work, edition and chapter, and declares that chapter as its spoiler ceiling.

The packet contains the user-authored original summary plus source-integrity metadata. It contains no EPUB/XHTML bytes, source passage, filename, URI, archive path or navigation locator.

## Local review contract

`buildHoidHistoricalEditorialReviewPacket()` binds the summary digest and source receipt metadata into a deterministic packet ID. The initial checklist is entirely false and the packet begins at `pending-human-review`.

`validateHoidHistoricalEditorialReviewDecision()` supports:

- `approved`, only when all five checks pass and the sole note is `no-issues`;
- `revision-required`, when at least one issue is recorded;
- `rejected`, when at least one issue is recorded.

The checklist covers factual accuracy, completeness, originality, spoiler ceiling and provenance.

The Hoid EPUB panel exposes this checklist after saving a draft. It allows the reader to record either a local approval (only when all five checks pass) or a revision request. The reviewer label is visible and editable but remains explicitly unauthenticated. Both the packet and decision are held only in the current source session.

A reviewer label is deliberately marked `unverified-local-label`. It is not an authenticated identity, Ed25519 signature, independent reviewer quorum or trusted approval. A local approval is reported only as `approved-awaiting-trusted-promotion`.

## Session lifecycle

The controller accepts a review decision only for the exact packet object created from the current handoff and current draft. Editing/replacing the draft invalidates the previous packet and receipt. Releasing/changing the EPUB, changing work/edition, changing progress, unmounting or starting a new session clears all evidence, packet and decision references.

No decision or packet survives the in-memory session.

## Hard safety boundaries

- `providerEgress: none`: summary text is not sent to an AI provider.
- `sourceTextIncluded: false` and `sourceTextPersisted: false`.
- `promotionAllowed: false` and `productionWritePerformed: false`.
- `authorizationEffect: none` and `spoilerAuthorization: none`.
- Local approval does not bypass the existing root-authenticated reviewer registry, signed review bundle, exact-unit evidence checks, progress revalidation or trusted promotion host.
- The originality checkbox is a human declaration, not an automated plagiarism detector. Reviewers must not paste protected source passages into the summary.

The packet's spoiler ceiling is a declared review scope, not proof that the summary contains no later-book information. The human checklist and the production exact-unit spoiler gate remain mandatory.

## Validation

The Run 343 workflow runs the historical editorial packet tests, session-bound review tests, historical reinspection regressions and review-queue regressions, followed by strict TypeScript checking of the domain modules and Hoid EPUB panel integration.

No private EPUB bytes or new narrative claims are included in the repository.
