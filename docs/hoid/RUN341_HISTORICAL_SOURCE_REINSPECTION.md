# Run 341 — exact historical source reinspection

## Objective

Allow a previously inspected chapter to be re-opened for a future human editorial review after the reader explicitly selects the EPUB again. The old device-local receipt is only an expected identity and digest; it never substitutes for the source bytes.

## Contract

`reinspectHoidHistoricalSourceChapter()` accepts:

- a validated device-local inspection receipt;
- an explicit source descriptor created from the selected local source;
- the package candidate issued by the same EPUB ingestion instance;
- that instance's provider-neutral chapter-inspection port;
- a canonical verification timestamp and optional cancellation signal.

It resolves the receipt's chapter number against the exact registered edition manifest. A chapter is eligible only when exactly one manifest unit has that number and a verified navigation locator. Ambiguous duplicate chapter numbers fail closed.

The selected package must match the receipt's work, edition and navigation digest. The ingestion adapter then re-inspects the exact manifest-bound navigation target. The returned candidate must match the selected package, work, edition, navigation target and manifest digest.

## Outcomes

| Result | Meaning |
|---|---|
| \`verified\` | The selected chapter's SHA-256 and byte length exactly match the historical receipt. An ephemeral handoff attestation permits a human review to begin. |
| \`changed\` | The document digest or byte length differs. The historical receipt is preserved and review remains blocked. |
| \`rejected\` | Receipt, source, edition, manifest, locator, candidate, timestamp, cancellation or local inspection could not be verified. |

The attestation is ephemeral and metadata-only. It does not include a digest, source identifier, local path, EPUB/XHTML bytes, text, locator or provider payload.

## Safety invariants

- The source must be explicitly selected again; filenames never identify a work or edition.
- The package candidate must be the original object issued by the same ingestion instance. The ingestion implementation enforces this with its instance-bound candidate state.
- Only a unique, exact edition-manifest unit can be re-inspected.
- Both the chapter SHA-256 and byte length must match the historical receipt.
- A changed source never replaces, deletes or silently refreshes the old receipt.
- The function does not persist an attestation or new receipt.
- No summary is generated, reviewed, approved or published by this operation.
- No production knowledge, approved claim, progress event or spoiler authorization is created.
- The returned attestation sets \`authorizationEffect: "none"\` and \`editorialEffect: "none"\`.
- The function returns no source content. It is a verification handoff only; a separate local human-review workspace is still required.

## Provider boundary

The function depends on the narrow \`HoidHistoricalChapterInspectionPort\`, which is a structural pick of the provider-neutral EPUB ingestion service. Expo, browser or test adapters can implement the same contract. No vendor SDK or model API is imported.

## Validation

The focused suite covers exact-match verification, tampered receipts, work/edition mismatch, package mismatch, changed digest, changed length, rejected inspection, malformed candidates, cancellation, adapter exceptions, invalid timestamps and output data minimization.

Run the dedicated workflow:

\`.github/workflows/hoid-run341-historical-source-reinspection.yml\`

The workflow runs the new suite together with receipt and review-queue regressions, followed by strict TypeScript checking.

## Deliberately deferred

The current UI continues to display receipts as awaiting source reselection. This run adds the verified domain operation but does not yet expose a reinspection button or a review editor. The next integration must bind the ephemeral attestation to the active local-source session, invalidate it on source release/change, and only then offer a local human-review workspace. It must not persist chapter text or route draft summaries into production knowledge.
