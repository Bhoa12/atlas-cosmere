# Hoid Run 337 — source coverage transparency

## Objective

Expose the repository's existing source-coverage audit in HoidScreen without conflating bibliography metadata, navigation verification, inspected chapter documents, editorial drafts, and production-approved knowledge.

## Implementation

- Add `getHoidSourceCoverageDisplayProjection()` as a provider-neutral, metadata-only UI projection.
- Add `HoidSourceCoveragePanel` with aggregate coverage and optional detail for the currently focused work.
- Show catalogue, navigation, individually inspected chapter-document, draft-review, and production-approval counts separately.
- State explicitly that the report's source access status is `not-asserted` and that source content is not included.
- Keep raw XHTML, source text, locators, navigation hashes, document hashes, draft prose, evidence IDs and fingerprints out of the display projection.
- Mark the projection with `authorizationEffect: "none"`.

## Verified repository snapshot

The existing source-coverage audit reports:

- 24 catalogued works: 17 from `cosmere.epub` and 7 Roshar works.
- 20 works with verified navigation locators, comprising 1,110 locators.
- 73 individually inspected chapter-document fingerprints across four works:
  - El Imperio Final: chapters 1–11.
  - El Camino de los Reyes: chapters 1–23.
  - Danzante del Filo: chapters 1–20.
  - Esquirla del amanecer: chapters 1–19.
- 69 original summary drafts, all pending editorial review.
- 0 production knowledge entries and 0 approved production claims.

These are repository metadata and audit results. They do not prove that the original EPUB bytes are currently mounted or available to this runtime. A chapter-document fingerprint is not the chapter text, and a draft summary is not approved knowledge.

## UI behavior

The panel always displays aggregate counts. Its optional detail view is bound to the currently resolved reading focus and shows only:

- work title and source group identity;
- navigation and manifest status;
- verified locator count and any ambiguous chapter numbers;
- inspected chapter numbers and counts;
- staged summary chapter numbers and pending-review counts;
- production knowledge count.

No summary prose is displayed. If no work is focused, the panel asks the reader to select a focus before showing per-work detail.

## Security and authorization boundary

The projection is descriptive only. It must never be used to authorize a narrative answer, unlock an evidence unit, infer source availability, or bypass the trusted exact-unit answer host. Production claims remain empty until accessible source passages have been checked and the required editorial approvals have been completed.

No private EPUB bytes, XHTML, chapter text, or unreviewed narrative prose are added by this run.

## Validation

`src/hoid/sourceCoverageDisplayProjection.test.ts` covers catalogue identity, navigation/document distinction, current editorial counts, selected-work projection, ambiguous numbering, blocked segmentation, unknown work handling, immutable output, and the absence of source prose or sensitive structural identifiers.
