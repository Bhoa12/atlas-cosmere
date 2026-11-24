# Run 286 — exact-unit evidence authorization boundary

## Objective

Add a provider-neutral authorization boundary that evaluates editorial evidence policies against the v3 exact-unit progress ledger. This is the first ordinal-native authorization primitive; it does not translate duplicate chapter labels into legacy numeric permissions.

## Exact evidence policy

Each evidence item is described by three edition-bound chapter references:

- `source`: exact unit where the original editorial evidence was checked;
- `firstSafeAppearance`: exact unit that establishes when the entity/topic may first be discussed;
- `unlock`: exact unit that must be completed before the complete evidence summary may be used.

All references must validate against the current edition manifest and belong to the same work. The unlock ordinal cannot precede either the source or the first safe appearance.

## Authorization semantics

For a v3 cursor at ordinal N, only the verified prefix through N-1 is completed. The currently open unit N never unlocks its own evidence. An explicit whole-work completion attestation is the only state that authorizes all remaining numbered and unnumbered material.

The authorizer revalidates the complete v3 snapshot and all three exact references on every call. It rejects malformed snapshots, duplicate work positions, stale fingerprints, cross-work policies, and policy records with extra fields or accessors.

## Fresh coordinator facade

`HoidUnitEvidenceAuthorizer` calls `HoidUnitProgressCoordinator.refresh()` before each authorization. It exposes the coordinator's payload-free invalidation subscription so a host can abort pending work and discard cached answer candidates.

This is not yet a complete conversation gateway integration. A production host must:
1. subscribe before starting asynchronous selector/provider work;
2. authorize every evidence item locally;
3. pass only already-approved claim IDs/candidates to the selector;
4. refresh and reauthorize all selected evidence immediately before rendering;
5. discard the response if the progress revision or authorization set has changed.

No progress cursor, unit ID, locator, fingerprint, or private EPUB navigation data may be sent to a provider.

## Integration boundary and limitations

- The existing `HoidEvidenceRuntime` and Atlas v2 coordinator remain active and unchanged.
- This run introduces a unit-aware policy contract and authorization service; it does not yet replace the legacy `evidenceUnlock.chapter` schema or wire the authorizer into `HoidConversationGateway`.
- Existing numeric evidence entries remain governed by the existing runtime. Exact-unit policies are not inferred from numeric chapter labels.
- The manifest still exposes only its verified contiguous prefix. Missing ordinal units remain unavailable; the authorizer cannot bridge structural gaps.
- No EPUB, XHTML, chapter prose, titles, or protected passages are copied or uploaded. Tests use synthetic metadata and original synthetic summaries only.

## Verification

The dedicated workflow runs the new authorization tests plus regressions for the exact-unit coordinator, cursor, and ledger. Strict TypeScript checking includes the authorization boundary and its imported dependencies.

CI doubles validate the provider-neutral contract but do not replace native Android/iOS SQLite interruption and restart tests.
