# Run 272 — recommendation display data minimization

## Goal

Keep trusted recommendation records more privileged than the React view model. The edition-bound recommendation pipeline needs cursors, manifest IDs, edition/navigation digests, opaque EPUB locator IDs and progress fingerprints to validate a future reader handoff. The chat UI needs only bibliographic labels, explanatory text and a coarse navigation availability state.

The thematic recommendation presenter needs claim/evidence/locator identifiers to verify reviewed claims. The UI needs only the topic labels, original explanation text, and canonical work/chapter citations.

## Changes

- Add \`recommendationDisplayProjection.ts\` with separate projections for edition-bound and thematic recommendations.
- Validate edition cursors against their exact reading manifest before reducing them to \`catalog-only\`, \`cursor-only\` or \`verified\`.
- Omit edition cursors, manifest IDs, edition IDs, navigation SHA-256 values, locator IDs, progress revisions and progress fingerprints from the edition recommendation view model.
- Keep the complete trusted edition recommendation only in a component-local ref. The UI can request a reader handoff by canonical work ID; the handler resolves the private target from the ref and the existing navigation boundary revalidates it against live progress immediately before opening.
- Project thematic recommendations after the signed presenter has verified them. Omit claim IDs, evidence IDs and EPUB locator IDs; rebuild visible work titles from the bibliography and retain only work ID/title/chapter.
- Validate topic and dimension labels against the canonical taxonomy and verify visible citation chapters against the source work's reading manifest.
- Reject malformed records, accessors, sparse arrays, non-canonical titles/labels, self-sourced evidence and inconsistent navigation targets. No partial recommendation list is displayed.
- Update HoidScreen to store only display projections in React state and use metadata-derived keys instead of internal claim/evidence IDs.
- Add adversarial and immutability tests plus a dedicated workflow.

## Trust and freshness

The projection is not an authorization mechanism. Edition recommendations are created by the existing local presentation constructor and checked for freshness against the current validated progress before commit. The private raw record is never passed to a provider or copied into React state. A reader action resolves the target from the private ref and still passes through \`openHoidRecommendationChapter()\`, which refreshes and revalidates progress, edition, manifest, cursor and locator.

Thematic recommendations are projected only after \`trustedTopicRecommendationPresenter.present()\` succeeds and the result is confirmed against the latest progress revision/fingerprint and the selected topic snapshot.

The private edition target ref is cleared on progress/trust changes, cancellation, request replacement and unmount. The thematic freshness/trust binding is also held outside React state and cleared whenever its result is invalidated. The visible edition projection is tied to the exact object held by its private ref; a stale or replaced projection cannot resolve a navigation target.

## Tests

The focused suite verifies:

- edition target locator/manifest binding;
- removal of cursor, locator, edition hash and progress identity from the UI projection;
- safe selection-required choices;
- accessor and Proxy rejection without executing getters;
- canonical bibliography/taxonomy labels;
- omission of claim/evidence/locator identifiers from thematic recommendations;
- rejection of self-sourced evidence and sparse/duplicate arrays;
- deep immutability of both projections.

All fixtures are synthetic metadata. No private EPUB, XHTML or copyrighted passage is opened or committed.

## Privacy and spoiler safety

The projection does not read EPUB content, change reading progress, unlock chapters, create narrative summaries or authorize claims. The trusted presenter and progress gates remain authoritative. The bibliography remains metadata-only.

## Validation

The dedicated workflow runs the focused Vitest suite and strict TypeScript checking for the projection module. HoidScreen integration is also covered by the repository's existing screen, recommendation and progress workflows. Run 272 is not considered certified until all required checks on its final HEAD succeed.

## Isolation

- Base: \`feat/hoid-ia-core-run271\`.
- New branch: \`feat/hoid-ia-core-run272\`.
- Run 271 PR remains open and unchanged.
- No writes to \`main\`, no retargeting of prior PRs, and no automatic merge.
