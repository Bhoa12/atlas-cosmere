# Run 125 — stale CI fixture repair

## Why this change exists

The Run 124 pull-request workflows completed, but four of the seven checks failed. The failures were not provider or runtime regressions: the test fixtures still described the pre-Run-124 editorial inventory and treated The Way of Kings chapter 8 as uninspected even though Run 124 had added its exact document digest.

## Repairs

- Update the staged-summary chapter range to include the verified chapter-nine drafts.
- Move the negative document-fingerprint assertion to The Way of Kings chapter 9; chapter 8 is now present in the verified-document allowlist.
- Update the source-document inventory expectation from 26 to 29, matching the 29 staged summaries and 29 individually inspected documents.
- Update receipt-count expectations for the current 47-record review inventory and its resolved subset.
- Move synthetic uninspected-entity and alias evidence fixtures to The Way of Kings chapter 9 so the tests continue to exercise a genuinely uninspected document rather than a now-verified chapter.

## Safety invariants retained

- Chapter-document digests are added only after direct source inspection; this repair does not add or alter any digest.
- A source at chapter N remains unavailable while chapter N is merely open; the test fixtures continue to use the strict completion boundary.
- The 29 summaries remain pending editorial review.
- No identity is inferred, no review receipt is fabricated, and no production registry is changed.
- No EPUB, XHTML body, extracted passage, image or protected book text is committed.

## Validation

The branch is intentionally kept separate from main. The pull-request workflows are the authoritative validation for this repair; no check is described as successful until GitHub reports a completed success conclusion.