# Explanation safety contract

Hoid IA treats explanations as a narrative output surface, not as a harmless
presentation layer. Every factual narrative claim must remain inside the
request's immutable knowledge boundary.

## Contract

Each explanation claim declares:

- non-empty original text produced for the request;
- one or more evidence identifiers already authorized for that request.

`verifyExplanation` rejects a claim when any declared evidence identifier is
outside the boundary. It does not silently drop an unauthorized reference and
keep the claim, because that could leave a seemingly supported statement whose
original justification depended on future knowledge.

## Fail closed

If no claims survive, callers must use the existing response decision policy to
limit or abstain. The verifier never substitutes model knowledge, catalogue
membership, or reading progress for evidence.

This module stores no protected source passages. It operates only on generated
claim text and opaque evidence identifiers.
