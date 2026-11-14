# Hoid IA response decision policy

This module is the final mode-selection boundary after evidence and claim
verification. It does not inspect private EPUB prose and it does not create
narrative knowledge.

## Modes

- `answer`: at least one verified claim exists and nothing was filtered.
- `limited`: verified claims exist, but one or more proposed claims were
  rejected. The caller should expose only the surviving, verified content.
- `abstain`: Hoid IA must not answer narratively from the supplied result.

## Fail-closed invariants

A response abstains when the question is empty, when there is no authorised
evidence, or when no verified claims survive. Reading progress alone is never
evidence, and catalogue membership is never permission to infer plot facts.

Provider confidence is intentionally ignored by this policy. A provider may
propose text, but cannot promote its own knowledge into authorised context.

## Integration

The intended order is:

`progress -> context budget -> authorised evidence -> provider draft ->
claim verification -> response decision`

The UI may attach an explanation of the decision, but that explanation must not
reveal rejected narrative content or identify future chapters as the reason for
the rejection.
