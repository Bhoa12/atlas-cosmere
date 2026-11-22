# Run 236 — HoidScreen recommendation integration

## Objective

Connect the progress-explainable, edition-bound recommendation contract to the actual Hoid screen. The UI must display the same metadata-only explanations that are covered by the provider-neutral core, and must not retain them after the authoritative progress identity changes.

## New screen adapter

`editionBoundRecommendationPresentation.ts` composes:

1. cursor-v2 snapshot validation and deterministic edition-bound recommendation;
2. metadata-only Spanish explanation;
3. the caller's progress revision and fingerprint.

It rejects malformed identities and any revision mismatch. The screen still re-reads the authoritative progress snapshot after the synchronous calculation and compares revision plus fingerprint before committing the view model.

## HoidScreen integration

The catalogue recommendation path now calls the provider-neutral edition-bound recommender directly. It no longer requires the narrative conversation gateway to be initialized merely to explain progress or catalogue metadata.

When multiple works are active, the screen displays an explicit selection state with one action per validated active cursor. Selecting a work reruns the recommendation against the same core and requires the chosen work to remain in progress.

Ready recommendations display:
- a deterministic heading;
- a progress-derived explanation;
- whether the destination is a verified locator, cursor-only, or catalog-only.

The screen does not navigate from these cards. Opening a chapter remains a separate operation that must revalidate the cursor against the current manifest and the normal Atlas navigation boundary.

The chat intent for catalogue recommendations uses the same provider-neutral adapter. It does not call an AI provider or treat explanations as narrative evidence.

## Freshness and spoiler invariants

- The adapter receives the authoritative v2 snapshot, not a legacy numeric map.
- The adapter checks the snapshot revision against the caller's validated identity.
- The UI re-reads progress before committing a recommendation result.
- The render path hides recommendation state when revision or fingerprint differs.
- An explicit selection is accepted only while that work still has an open cursor.
- No recommendation creates a narrative evidence grant or advances the reader.
- Missing EPUB locators remain cursor-only; unsegmented works remain catalog-only.
- No route, locator, chapter title or narrative fact is guessed.
- The narrative answer path, signed presenter and evidence runtime are unchanged.

## Provider boundary

The recommendation presentation adapter is deterministic and provider-neutral. It consumes validated progress and catalog/manifest metadata only. It does not invoke a model, network endpoint, retrieval provider or external API.

## Validation

The dedicated workflow runs five Vitest suites and a strict TypeScript check that includes `HoidScreen.tsx` and the new adapter. The final pull-request head must pass before this run is considered validated.
