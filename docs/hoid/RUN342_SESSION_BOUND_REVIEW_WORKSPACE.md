# Run 342 — session-bound historical review workspace

## Objective

Connect exact historical chapter reinspection to a device-local review workspace without allowing a stale EPUB selection, a changed source, or a late asynchronous result to survive a source-session boundary.

## Session contract

`createHoidHistoricalReviewSessionController()` is provider-neutral and keeps its state in memory only.

- `beginSession({ sourceId, workId, editionId })` creates one opaque lease for the explicitly selected local source and registered work/edition.
- `verifyAndBind(lease, input)` checks that the reinspection input uses the same source, work and edition before calling the historical reinspection operation.
- A successful verification produces a session-bound handoff that is tracked by object identity in a private WeakMap.
- A source switch, work/edition change, explicit release, progress change or screen unmount invalidates the lease.
- A result that completes after invalidation returns `stale-session`; it cannot open the workspace.
- An old lease cannot invalidate a newer session.

The handoff deliberately omits source identifiers, file URIs, paths, locators, digests and chapter text.

## Local draft workspace

After a successful handoff, a reviewer may write an original summary in the local screen.

- The draft is held only in the controller's in-memory WeakMap.
- It requires an explicit originality attestation.
- It is bounded to 80–3,000 characters and rejects XHTML-like payloads and local file references.
- It is discarded when the source session is invalidated or the handoff is explicitly discarded.
- It is not persisted, sent to a model/provider, added to production knowledge, approved, published, or used to authorize spoilers.

The originality checkbox is a human attestation, not an automated plagiarism detector. The application cannot prove that a user-authored draft is original; editorial review remains a separate required stage.

## UI integration

`HoidEpubImportPanel` now offers historical reinspection only when:

1. a local EPUB is selected;
2. the user explicitly selects the same catalogue work and edition as the receipt;
3. the current package candidate is available in the same ingestion runtime;
4. a valid device-local receipt exists for that exact work, edition and chapter;
5. the active review-session lease still matches the selected source.

The user can then draft an original summary locally. Changing/releasing the EPUB, changing the selected work/edition, changing reading progress, or unmounting the panel invalidates the attestation and clears the draft from memory.

## Safety invariants

- No chapter bytes, XHTML or text are copied into the review handoff.
- No chapter text is persisted by this feature.
- No draft text is sent to an LLM or external provider.
- No approval, publication, production write, progress event or spoiler authorization is created.
- Historical receipts remain unchanged.
- Changed or unverifiable documents cannot open the workspace.
- All asynchronous completion paths re-check both the component lifecycle and the session lease.

## Validation

The dedicated workflow runs the session-controller tests and historical-reinspection regression suite, then strict TypeScript checking for the domain controller, tests and integrated React Native panel.
