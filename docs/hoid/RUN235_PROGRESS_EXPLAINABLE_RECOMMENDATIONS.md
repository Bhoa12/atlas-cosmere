# Run 235 — Progress-explainable edition-bound recommendations

## Objective

Make reading recommendations transparent and unambiguous without adding narrative knowledge. The recommendation core must explain which validated progress fact caused a suggestion and must explicitly ask the reader to choose when more than one work is in progress.

## Run 234 CI repair

The Run 234 recommendation workflow successfully executed all four Vitest suites (57 tests), but its strict TypeScript step failed with TS18048 because TypeScript could not preserve narrowing of the mutable optional `activePosition` inside a `.find()` callback.

The implementation now captures the narrowed `bookId` in an immutable local before entering the callback. The strict type-check remains enabled; no compiler option was relaxed.

## Explicit active-work selection

`recommendEditionBoundReadingNextSteps()` now has three result states:

- `ready`: one active work was unambiguous, an explicit active work was supplied, or there is no active work.
- `selection-required`: more than one work has an open cursor and the caller did not select one.
- `unavailable`: the snapshot, limit or explicit active-work identifier is invalid.

The `selection-required` response contains deterministic choices in canonical bibliography order. Each choice reports only the work ID, catalog title, current cursor chapter and completed-through watermark. It does not infer a preferred work.

An explicitly supplied active-work ID must identify a work that is actually in progress. A completed or unread work cannot be passed as the active resume target.

When selection is required, the recommender returns no discovery items. This prevents an interface from silently hiding an unresolved resume decision behind unrelated suggestions.

## Metadata-only explanations

`editionBoundRecommendationExplanations.ts` projects the deterministic result into UI-ready, Spanish explanations.

Supported explanation codes:

- `resume-current-cursor`: reports the exact open chapter and completed-through watermark.
- `start-first-numbered-chapter`: explains that a work has no progress and that the edition manifest supports chapter one.
- `catalog-only-unsegmented`: explains that the work is catalogued but its chapter segmentation is not verified.
- `catalog-only-unit-missing`: explains that the requested numbered unit is not present in the current manifest.

The multi-work state returns a clear selection prompt and a short progress description for each choice.

The formatter does not generate prose about the plot, infer chronology, inspect EPUBs, call an AI provider, authorize evidence, or modify progress. It preserves the original navigation target so the UI can pass it through the existing cursor-validation boundary.

## Safety invariants

- Cursor-native v2 progress is validated before recommendations are produced.
- A resume target must be selected explicitly when multiple works are in progress.
- An explicit active work must actually have an open cursor.
- A cursor remains bound to the exact manifest, edition and navigation digest.
- A missing locator remains `cursor-only`; no EPUB path or URL is guessed.
- Unsegmented works remain catalog-only.
- Explanations are limited to catalog metadata and validated progress facts.
- No recommendation explanation is narrative evidence or a spoiler authorization.
- The UI must validate the cursor again before opening a chapter.
- No provider, private EPUB, XHTML, protected passage, reader progress or production claim is added.

## Validation

The dedicated workflow runs:

- edition-bound recommendation tests;
- recommendation explanation tests;
- cursor progress ledger tests;
- legacy recommendation regressions;
- reading manifest tests;
- strict TypeScript checks across the recommendation and progress contracts.

The workflow result on the final PR head must be checked before considering this run validated.
