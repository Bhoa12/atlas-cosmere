# Run 130 — segment-level evidence provenance

## Purpose

Keep the claim-to-evidence relationship intact from the authorized graph explanation through the final answer and the Hoid chat UI. A global bibliography list is not enough for a multi-claim explanation: each displayed claim must carry only the sources that support that exact claim.

## Contract

HoidEvidenceAnswer now optionally carries both:

- layout: one of plain, numbered or grouped.
- segments: ordered records containing claimId, exact editorial text and the evidence IDs attached to that claim.

The pair is all-or-nothing. Legacy single-answer results without segment provenance remain supported and keep the existing global citation block.

## Validation at the presentation boundary

presentHoidEvidenceAnswer validates segment provenance independently of TypeScript declarations:

1. The segment array must be dense, plain and bounded to the authorized claim count.
2. Segment claim IDs must match the answer's claim IDs in the same order.
3. Each segment must contain unique, canonical evidence IDs.
4. Every segment evidence ID must resolve to an already validated top-level citation.
5. The union of segment evidence IDs must equal the answer's complete evidence manifest; no source can be silently dropped or introduced.
6. Re-composing the exact segment text with the declared neutral layout must reproduce the answer text byte-for-byte.
7. Every citation must still pass the existing work-local unlock check against the current validated progress snapshot.

A failure withholds the whole answer. No partially cited explanation is displayed.

## UI behavior

HoidScreen renders each validated segment separately and places its own work/chapter citations immediately below it. Numbered and grouped layouts retain their neutral structural markers. Older answer shapes without segment provenance continue to render their original text and global citations.

Progress-scoped history still stores the complete message object. If the reader changes progress, the existing history policy removes the assistant message, including its segment citations.

## Tests

answerPresentation.test.ts covers exact mapping, claim-order mismatch, unlisted evidence, altered composed text, incomplete layout/provenance pairs and locked evidence. relationshipPresentation.test.ts confirms that the graph adapter carries the validated mapping forward.

## Safety and limitations

- Segment metadata contains only original editorial claim text and opaque evidence IDs; it never contains EPUB passages.
- Edition, navigation digest, chapter locator and document digest are still validated by the relationship presentation boundary before the answer contract is created.
- The final presentation rechecks the progress unlock threshold.
- The optional provider remains unable to author, reorder or alter claim text.
- No knowledge is promoted and no reader progress is modified.
- The production editorial registry remains empty until independent human review is complete.
