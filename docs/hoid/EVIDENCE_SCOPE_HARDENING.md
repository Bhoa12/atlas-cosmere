# Evidence scope hardening

## Purpose

`isEvidenceUnlocked` is an exported authorization boundary, not merely an internal helper. It must validate reader progress itself rather than assume every caller has already passed through `HoidEvidenceRuntime`.

## Invariant

Evidence is unlocked only when exactly one valid progress position exists for the evidence unlock book and that position reaches the declared chapter (or is explicitly completed). Duplicate positions for a book are ambiguous and reject authorization regardless of their order.

## Implementation

The function now delegates progress normalization to `validReadingPositions` before looking up the unlock position. This keeps duplicate handling, chapter bounds, completion semantics, and collection limits aligned with the rest of Hoid input boundary.

## Regression coverage

`src/hoid/evidenceScope.test.ts` covers:
- the exact unlock threshold;
- duplicate positions in both orders;
- conflicting completed and incomplete positions;
- progress from a different work;
- malformed progress containers.

The focused GitHub Actions workflow runs these tests alongside the evidence runtime tests and type-checks the runtime and scope modules.

## Source policy

Tests use synthetic metadata only. No EPUB content, source passages, or unverified narrative claims are added.
