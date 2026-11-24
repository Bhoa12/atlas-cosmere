# Run 271 — answer display data minimization

## Objective

Keep the user-facing chat model smaller and less privileged than the trusted evidence presentation that authorizes it.

## Change

The trusted presenter still validates the complete evidence record, including the edition-bound EPUB locator and unlock watermark, against the authoritative progress snapshot. Only after that validation, `projectHoidAnswerForDisplay()` creates a detached UI projection containing:

- answer text;
- evidence ID for stable rendering identity;
- canonical work ID and bibliography title;
- verified chapter number;
- per-claim text and its visible citations;
- narrative layout when segmented provenance is present.

The projection deliberately omits:

- internal EPUB `locatorId`;
- unlock book/chapter thresholds;
- raw top-level `claimIds` and `evidenceIds` arrays;
- per-segment raw `evidenceIds` arrays;
- provider envelopes and source payloads.

The locator remains available only inside the trusted verification path where it is needed to bind a citation to the exact edition manifest unit. It is not retained in the React message state or rendered component props.

## Fail-closed behavior

A presentation that has segments without a layout, a layout without segments, or an empty segmented answer is rejected. HoidScreen routes this through its existing neutral error path, clears the conversational context binding, and displays no partial citations.

The screen continues to render book titles and chapter numbers for each claim. Cross-work summaries remain metadata-only and do not contain EPUB locators.

## Tests

The focused suite verifies locator stripping, omission of unlock metadata and raw evidence arrays, preservation of claim-to-source attribution, deep freezing, detached object identity, non-segmented answers, and rejection of incomplete presentation contracts.

## Privacy and spoiler safety

- No private EPUB is read or committed.
- No XHTML, chapter text, locator, or file handle is sent to a provider.
- The trusted presenter continues to recheck every evidence unlock against live progress before projection.
- The display projection cannot authorize new evidence or change reading progress.
- Tests use synthetic metadata only.

## Isolation

- Base: `feat/hoid-ia-core-run270`.
- Branch: `feat/hoid-ia-core-run271`.
- Pull request remains a draft and is not merged.
- `main` and all existing run branches remain untouched.
