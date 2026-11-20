# Run 171 — Run 170 regression repair

## Audit

The 19 pull-request workflow runs associated with Run 170 completed with 7 successes and 12 failures. The failures were deterministic fixture drift after the four additional inspected chapter documents and four staged summaries; they did not indicate that the new source digests or the production spoiler gate had failed.

The distinct stale assumptions were:

- the Cosmere navigation audit still expected four inspected El Imperio Final chapter bodies instead of five, and its Roshar document counts still stopped before the latest chapters;
- the source-coverage snapshot getter test still duplicated the previous El Camino de los Reyes chapter list;
- the editorial review packet test still enumerated 39 draft IDs instead of all 43;
- the topic-taxonomy negative test used El Imperio Final chapter 5, which is now individually verified;
- the entity and alias negative tests used El Camino de los Reyes chapter 12, which is now individually verified;
- the coreference promotion test retained the old extra-chapter assumption instead of the completed-through watermark semantics.

## Changes

- Update the exact sparse-document counts to TFE 5, TWOK 12, Edgedancer 13 and Dawnshard 13.
- Make the sorted TWOK document-number getter test compare against the canonical coverage snapshot, whose exact chapter list is asserted separately.
- Add the four Run 170 summary IDs to the deterministic editorial review packet inventory.
- Move negative source-provenance fixtures to genuinely uninspected chapters: TFE 6 and TWOK 13.
- Align the coreference test with the invariant that evidence from source chapter N unlocks when the open cursor reaches N+1.

## Safety

- Test fixtures and documentation only; no production runtime or authorization logic changes.
- No summary is approved, no claim is promoted and no production knowledge entry or activation receipt is created.
- No reading progress, EPUB, XHTML, extracted passage, image or private file URI is changed or committed.
- All 43 staged summaries remain pending independent editorial review.
- The 24-work bibliography and source-document allowlist are unchanged.

## Validation

The new branch must pass the affected suites and all dependent PR workflows on its own HEAD. The Run 170 results do not validate this repair branch. Keep the PR in draft and do not merge automatically.

## Isolation

- Base: `feat/hoid-ia-core-run170`
- Exact base HEAD: `0df9e7a796e25bb1f147b1c2a4436a7a4b2e0634`
- No changes are made to `main`, Run 170 or any earlier branch.
