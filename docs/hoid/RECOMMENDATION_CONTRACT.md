# Hoid IA — Recommendation Contract

## Purpose

Recommendations are useful only when they do not disclose narrative information the reader has not unlocked. This contract keeps recommendation logic separate from narrative retrieval and provider generation.

## Allowed inputs

A recommendation engine may use only:

- the immutable reading snapshot for the request;
- canonical catalogue metadata;
- explicit reader preferences;
- non-narrative relationship metadata, such as publication grouping or series membership.

It must not inspect future chapter summaries, hidden evidence, provider memory, or unrestricted retrieval results to decide what to recommend.

## Contract

```ts
export interface SafeRecommendationInput {
  reading: readonly ReadingPosition[];
  preferences?: ReaderPreferences;
  catalogue: CatalogueMetadata;
}

export interface SafeRecommendation {
  workId: string;
  reason: string;
  basis: readonly RecommendationBasis[];
}
```

Every recommendation must expose a machine-readable basis. Valid bases are limited to progress, explicit preference, and non-narrative catalogue metadata.

## Fail-closed rules

A recommendation is rejected when:

1. its work is absent from the canonical catalogue;
2. its reason requires an unsupported narrative claim;
3. its basis contains future evidence;
4. the engine cannot explain the recommendation using permitted inputs.

When in doubt, Hoid IA should provide a narrower recommendation rather than infer story knowledge.

## Provider boundary

A language-model provider may phrase a recommendation, but it cannot select narrative evidence or expand the recommendation basis. The deterministic recommendation layer selects safe candidates first.

## Test matrix

Implementations should test:

- readers with different progress receive independently computed candidates;
- preference changes affect ranking without unlocking narrative evidence;
- a future chapter record cannot become a recommendation basis;
- missing catalogue metadata yields no fabricated recommendation;
- provider phrasing cannot add unsupported story claims.

This document intentionally contains no protected source text or narrative summaries.