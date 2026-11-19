# Evidence scope hardening

## Purpose

`isEvidenceUnlocked` is an exported authorization boundary, not merely an internal helper. It must validate reader progress itself rather than assume every caller has already passed through `HoidEvidenceRuntime`.

## Invariant

Evidence is unlocked only when exactly one valid progress position exists for the evidence unlock book and that position reaches the declared chapter (or is explicitly completed). The unlock chapter must be strictly later than the source chapter: opening chapter N never completes chapter N. A later threshold is permitted as a more conservative spoiler ceiling. Duplicate positions for a book are ambiguous and reject authorization regardless of their order.

## Implementation

The function delegates progress normalization to `validEditionBoundReadingPositions` before looking up the unlock position. Evidence provenance is also checked against the edition manifest, and `unlockChapter <= sourceChapter` is rejected before progress is considered. Thus even an explicitly completed cursor cannot rescue malformed same-chapter provenance.

## Regression coverage

`src/hoid/evidenceScope.test.ts` covers:
- the exact unlock threshold;
- rejection of a same-chapter unlock for both an open cursor and an explicitly completed work;
- duplicate positions in both orders;
- conflicting completed and incomplete positions;
- progress from a different work;
- malformed progress containers.

The focused GitHub Actions workflow runs these tests alongside the evidence runtime tests and type-checks the runtime and scope modules.

## Source policy

Tests use synthetic metadata only. No EPUB content, source passages, or unverified narrative claims are added.


## Run 169 — strict source-to-unlock ordering

A chapter-N summary must have an unlock threshold strictly later than N. The source chapter is still open while the cursor points to it, so a same-chapter threshold would violate the reader-boundary contract. Later thresholds remain valid when an editor deliberately chooses a more conservative spoiler ceiling.

Both `canonicalEvidenceScope()` and the review-packet canonicalizer reject `unlock.chapter <= source.chapter`. The evidence, draft and review-packet tests cover same-chapter attempts, including a forged explicit-completion position. No source text or reading progress is changed.
