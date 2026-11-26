# Hoid Run 325 — progress-aware reading recommendation planner

## Objective

Add a deterministic, provider-free recommendation layer that uses only the reader's validated exact-unit progress and the verified edition manifests.

The first supported recommendation is deliberately narrow: resume the exact chapter unit that the reader already has open. This is useful immediately, avoids inventing a Cosmere-wide reading order, and gives Atlas a safe recommendation contract to wire into the trusted screen.

## Contract

Implementation: `src/hoid/readingRecommendationPlanner.ts`

- `buildHoidReadingRecommendationPlan(progress, options?)` validates the v3 progress snapshot and resolves every unfinished cursor against the current edition manifest.
- Completed works are excluded.
- Active works are ordered only by the ledger's explicit `order` value; that value is not interpreted as last-read time or chronology.
- A candidate contains the bibliographic work ID/title, exact unit reference, ordinal and an optional unambiguous chapter label.
- Duplicate visible chapter labels are represented with `chapterNumber: null` and `labelMode: "exact-unit"`; no label is guessed.
- `validateHoidReadingRecommendationPlan(plan, freshProgress)` recomputes the plan and invalidates it when the catalogue, progress revision, progress fingerprint, candidate set or exact edition identity changes.
- The output is bounded to at most ten recommendations (default five).

## Security and spoiler boundaries

- No provider, network client, prompt, model output or external recommendation API is used.
- The planner never recommends a chapter after the currently open chapter. It recommends resuming the open unit itself.
- It does not infer publication chronology, in-world chronology, series dependencies or a universal Cosmere reading order.
- It does not recommend unstarted works. Cross-work "read this next" suggestions remain unavailable until a separately curated and trusted reading-path catalogue has been reviewed and authorized.
- It never reads EPUB files or chapter bodies and never includes private EPUB navigation locators in the plan.
- The chapter reference is identity-only. It does not grant progress, evidence access or permission to present narrative content.
- A plan is a UI recommendation, not an authorization capability. Narrative answers must still pass the exact-unit spoiler gate and presentation-time progress verification.
- Plans must be revalidated against the live progress snapshot immediately before presentation. Stale plans fail closed.

## Privacy

The plan contains only bibliographic IDs/titles, an exact chapter identity fingerprint, chapter ordinal/label metadata, the progress revision/fingerprint and a deterministic plan fingerprint. It does not contain raw progress timestamps, source paths, EPUB bytes, XHTML, source passages, provider credentials or chapter prose.

## Validation

The dedicated workflow runs:

- Vitest for the recommendation planner.
- Regression tests for exact-unit spoiler dependencies and the answer runtime.
- Strict TypeScript checking for the planner and its imported contracts.

Synthetic progress fixtures are used. No private EPUB is opened or modified by this change.

## Known limits and next steps

1. Wire the pure planner into the trusted conversation/application host and revalidate immediately before display.
2. Add a separately reviewed, signed reading-path catalogue before recommending a different work after completion.
3. Add preference signals (pace, preferred saga, format) only as ranking inputs; they must never override spoiler prerequisites.
4. Keep narrative recommendation text sourced from approved editorial claims, not generated from bibliography metadata.
