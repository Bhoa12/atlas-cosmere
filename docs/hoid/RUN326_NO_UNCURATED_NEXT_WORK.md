# Hoid Run 326 — no uncurated cross-work discovery

## Decision

Hoid must not recommend an unstarted Cosmere work merely because it appears earlier in the bibliography. Bibliographic order is catalogue order, not a reviewed reading path, publication chronology, in-world chronology, or spoiler dependency graph.

Run 326 removes that fallback from the existing screen recommendation pipeline.

## Runtime behaviour

- If exactly one work has an unfinished, validated edition cursor, Hoid offers only that exact unit for resumption.
- If several works are open, Hoid requires an explicit reader choice and does not rank one as the canonical next work.
- If no work is open (empty ledger or only completed works), the planner returns `no-safe-next-work`.
- An explicit selection that does not identify an actually open work is rejected.
- The existing exact edition cursor, edition identity, navigation hash, locator checks and presentation-time progress freshness remain mandatory. The exact cursor unit ID and ordinal are preserved; numeric cursor v1 still rejects duplicate visible chapter labels until a separately reviewed locator-bound progress contract exists.
- A zero-item limit can return an empty resume result, but it never causes discovery of another work.

## Why this is a spoiler control

The prior implementation filled remaining recommendation slots by iterating through `HOID_SOURCE_BIBLIOGRAPHY` and proposing chapter one of unstarted works. Even though those suggestions contained only metadata, the ordering itself was not backed by editorially reviewed cross-work prerequisites. This could imply an unsafe reading sequence.

The new behaviour does not infer a next work from:
- bibliography array order;
- a work's position in a saga label;
- a publication or in-world chronology that has not been reviewed;
- model/provider preference or similarity;
- the fact that a work's chapter-one manifest is structurally available.

## UI

The Hoid panel is now labelled **RETOMAR LECTURA**. When there is no active work, it explains that no next-work recommendation is available until an explicit, editorially reviewed reading path exists. The reader can still choose a work manually in Atlas; this does not unlock narrative evidence.

## Contracts and trust boundaries

- `editionBoundRecommendations.ts` emits only `resume-current-work`, `selection-required`, or `no-safe-next-work`.
- `editionBoundRecommendationExplanations.ts` rejects legacy `unread-source` payloads.
- `editionBoundRecommendationPresentation.ts` binds the no-safe state to the exact canonical progress fingerprint.
- `editionBoundRecommendationFreshness.ts` revalidates that state against the live progress projection.
- `recommendationDisplayProjection.ts` strips progress fingerprints and rejects unstarted-source items before React state.
- No provider is called; no progress is mutated; no EPUB or chapter body is read.

## Future cross-work recommendation contract

A future next-work catalogue must be a separately curated artifact. Each edge must identify its source work, target work, exact edition-bound prerequisite units, review provenance, schema version and immutable fingerprint. The resolver must fail closed for missing, ambiguous, stale or unreviewed prerequisites. No entries are inferred from the bibliography. Until such a catalogue has passed the editorial review/quorum process, `no-safe-next-work` is the correct result.

## Validation

The dedicated Run 326 workflow covers:
- edition-bound recommendation core;
- explanation canonicalization;
- progress-bound presentation and freshness;
- UI display projection;
- progress-aware recommendation planner;
- exact-unit spoiler dependency gate;
- exact-unit answer runtime;
- strict TypeScript checking, including `HoidScreen.tsx`.

All fixtures are synthetic. No private EPUB, XHTML, chapter prose, source path, reviewer key or provider credential is added to the repository.
