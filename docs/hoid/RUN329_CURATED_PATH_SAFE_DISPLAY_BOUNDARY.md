# Run 329 — safe display boundary for curated reading paths

## Objective

Expose curated cross-work recommendations to a future HoidScreen adapter without leaking chapter identity, EPUB locators, progress cursors, trust metadata or internal fingerprints.

The display boundary must not trust a previously validated plan merely because it is passed by the caller. It re-runs `validateHoidCuratedReadingPathRecommendationPlan` against the current catalogue, progress snapshot, route approvals, signed exact-unit rationale evidence and reviewer trust registry immediately before projecting UI data.

## Contract

`projectHoidCuratedPathRecommendationsForDisplay(input)` accepts the same complete validation context as the curated-path plan validator, plus the saved plan.

It returns either:

- `ready`: a bounded list of display items containing only a stable UI key, path title, work ID/title, the signed catalogue rationale, an explicit manual-selection action and a fixed rationale-authority label;
- `withheld`: a neutral reason code when the input, current plan or display data cannot be trusted.

The projection does not expose:

- chapter number, ordinal, unit ID or chapter reference;
- EPUB locator, navigation hash or private source path;
- reading cursor, progress revision or progress fingerprint;
- catalogue/path/evidence fingerprints;
- reviewer IDs, key IDs, signatures or trust-registry data;
- claim/evidence identifiers.

## Spoiler policy

The rationale is copied only from the catalogue that survives full plan revalidation. The underlying validator re-verifies the route quorum, the signed exact-unit claim packages, the exact source reference, first-safe-appearance and unlock dependencies, and the live progress snapshot.

If progress changes, an approval is revoked/stale, the evidence package changes, a trust check fails or a dependency is incomplete, the projection returns `withheld`. It never degrades to a title-only or chapter-number-only fallback.

Starting a new work remains a manual reader action. The projection does not return a chapter target, cursor, locator or navigation handoff.

## Provider boundary

This module is provider-neutral and makes no model/provider calls. The rationale comes from the signed editorial catalogue, not generated free-form provider text.

## Integration status and limitations

This is a tested presentation boundary, not yet wired into `HoidScreen` or the trusted application bootstrap. The production curated-path catalogue remains empty, and no real route can currently be displayed. The test catalogue, signatures, reviewer trust registry and progress snapshots are synthetic fixtures; they are not real editorial approvals or Cosmere reading routes.

No EPUB/XHTML body, protected passage, new narrative summary, source locator or production claim is added by this change. No progress is mutated and no production write or automatic navigation occurs.

## Validation

The dedicated Run 329 workflow executes the curated-path catalogue tests (including display-boundary regressions) and strict TypeScript checks for the route, evidence-signature and display contracts.
