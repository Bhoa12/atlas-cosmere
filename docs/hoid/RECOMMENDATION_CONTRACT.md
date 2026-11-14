# Recommendation safety contract

Recommendations are a distinct output surface and therefore cannot bypass Hoid IA's spoiler controls.

## Two categories

- **Structural recommendations** provide non-narrative guidance, such as reading pacing or how to continue using the application. They carry no evidence references and must not be used to assert story facts.
- **Narrative recommendations** make a claim about story content. Every such item must cite one or more identifiers already admitted to the immutable request knowledge boundary.

## Fail-closed verification

A narrative recommendation is rejected in full when any declared evidence identifier is outside the boundary. The verifier never silently removes the bad reference and keeps the recommendation, because the recommendation could have been derived from unauthorized future knowledge.

Empty recommendations are rejected. The output contains only normalized original response text and opaque evidence identifiers; it does not store EPUB passages.

This keeps the complete flow consistent:

`catalog → provenance → context admission → knowledge boundary → provider → claim/recommendation verification → response decision`.

Catalog membership and reader progress alone never authorize a narrative recommendation.
