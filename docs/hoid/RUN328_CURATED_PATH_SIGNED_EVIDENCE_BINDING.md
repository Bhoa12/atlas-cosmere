# Run 328 — signed evidence binding for curated reading paths

## Objective

Harden Run 327's curated reading-path evaluator so a route cannot cite a syntactically plausible but nonexistent evidence ID, nor reveal a rationale before the cited evidence's complete spoiler policy is satisfied.

This change is provider-neutral and uses the existing exact-unit editorial claim signature protocol. It does not add any real reading path or narrative content.

## Exact evidence binding

Every rationaleEvidence item in a non-empty route catalogue must resolve to a signed exact-unit claim package verified by verifyHoidExactUnitClaimSignatures.

The verification uses the same root-authenticated reviewer trust registry, Ed25519 verification port, repository identity, clock and minimum registry revision as the route approval quorum. The evidence review context must name the same repository as the route catalogue.

For every route evidence reference, Hoid requires:

1. The evidence ID to exist in a verified signed package.
2. The route's exact chapter reference (including edition/unit identity) to equal the package policy's source.
3. Every evidence ID in the approved claim to be declared by that route step; a route cannot silently omit part of a multi-evidence claim.
4. The step's explicit prerequisites to cover all three exact policy requirements: source, firstSafeAppearance and unlock.
5. Each prerequisite completion threshold to be at or after the corresponding requirement's exact ordinal in the same work.

If any binding is missing, mismatched, unsigned, revoked, stale, or beyond the declared prerequisite boundary, the evaluator returns blocked/evidence-unverified. It never falls back to the chapter number alone.

## Plan integrity

The recommendation plan now includes rationaleEvidenceFingerprint. This digest binds the signed claim-review context, trust-registry revision, verified claim/signature metadata and exact source/first-appearance/unlock references used by route rationales.

A saved plan is invalidated if its signed evidence package changes, even when the visible route title, rationale and reader progress remain unchanged.

When a catalogue contains no rationale evidence (for example, a synthetic single-step route), the evidence package list must be empty and a deterministic empty-evidence digest is used. The production catalogue remains empty, so it still yields no route.

## Trust and privacy boundaries

- Exact-unit packages are verified through the existing Ed25519 and root-authenticated reviewer trust protocol.
- Evidence source text and summaries are not copied into route plans or provider requests.
- The route evaluator returns only book-level manual-selection metadata.
- No chapter locator, EPUB path, cursor or chapter prose is exposed.
- No provider is called; no progress is mutated; no production catalogue is populated.
- Tests use synthetic claim/evidence fixtures and a test-only verifier. They are not editorial approvals or real Cosmere routes.

## Validation

The dedicated Run 328 workflow executes the curated-path suite and the existing exact-unit claim-signature suite, followed by strict TypeScript checks.

The new regressions cover missing evidence packages, exact-source mismatch, late unlock, first-safe-appearance dependencies in another work, omitted evidence IDs from multi-evidence claims, and saved-plan invalidation after a signed evidence package changes.
