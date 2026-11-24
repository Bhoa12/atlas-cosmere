# Run 281 — exact edition identity at the chapter evidence boundary

## Objective

Strengthen chapter-scoped follow-up retrieval so an evidence source is admitted only when its complete edition-bound locator resolves to the same chapter identity as the prior conversation anchor.

A numeric chapter label is not sufficient evidence of identity. The source book, visible chapter number, locator, current edition manifest, unit ID, ordinal and identity fingerprint must agree.

## Change

- `isHoidEvidenceInChapterScope()` now receives the evidence source locator in addition to its book ID and visible chapter number.
- It reconstructs the source reference through the current edition-bound chapter resolver.
- It rejects unresolved, mismatched, ambiguous or locator-less source tuples.
- It validates each chapter anchor again and compares book ID, unit ID, ordinal, chapter number and identity fingerprint.
- It rejects sparse arrays and non-canonical array shapes at this exported boundary.
- `HoidEvidenceRuntime` passes the already-canonicalized `evidenceSource.locatorId` into the exact scope filter.
- Tests cover a valid exact match, a chapter-number/locator mismatch, a cross-work locator mismatch, stale fingerprints and sparse scope arrays.

## Security properties

- The locator is used only inside the local evidence runtime. It is not added to the selector request, provider protocol, conversation binding, UI projection or serialized progress.
- The chapter scope remains a retrieval constraint, never a cursor, reading grant or editorial approval.
- Existing `evidenceUnlock`, `firstSafeAppearance`, claim attestation, book-scope and live-progress checks remain independent.
- An invalid or mismatched source fails closed and cannot become a provider candidate.
- No chapter body, EPUB content, protected passage, title or new narrative summary is added.

## Validation

The dedicated workflow runs the chapter-scope and evidence-runtime regression suites, the cursor facade, both conversation gateways and retrieval tests, followed by strict TypeScript checking.

The workflow result must be inspected on the final branch HEAD before Run 281 is described as certified. A successful PR mergeability state alone is not a CI result.

## Isolation

- Branch: `feat/hoid-ia-core-run281`.
- Base: `feat/hoid-ia-core-run280`, HEAD `9221c9ac005e769dee3741a2fb63d9b6a3fa15df`.
- This change is additive and isolated to the new branch.
- Run 280 and its PR remain untouched.
- `main` is not a target and no merge is performed.
