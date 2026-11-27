# Hoid Run 354 — fail-closed evolution intent routing

## Objective

Repair and harden the deterministic character-evolution intent parser without changing the production knowledge model or spoiler authorization boundary.

## Root cause found in Run 353 CI

The final Run 353 GitHub Actions execution completed with 144/145 tests passing. The single failure was:

- input: `¿Cómo ha evolucionado?`
- expected: `needs-name`
- actual: `not-evolution`

The parser's extraction prefix required whitespace or end-of-string after `evolucionado`. A trailing question mark therefore prevented the query from being recognized as an incomplete evolution request.

This was a real parser defect, not a flaky test. The strict TypeScript step was skipped because the test step failed first.

## Change

Add a closed set of exact, punctuation-tolerant empty-name patterns before entity-name extraction. These patterns cover the supported Spanish and English evolution prefixes and dimension-specific forms.

The parser now distinguishes:

- a recognized evolution request with no entity name (`needs-name`);
- a recognized request with a bounded exact name (`ready`);
- unrelated prose (`not-evolution`);
- malformed/control-character input (`invalid`).

Punctuation is consumed only by the empty-name recognizer. It is never returned as a candidate entity name. Existing exact-name extraction and alias resolution remain unchanged.

## Safety properties

- No fuzzy matching, semantic search, model-based entity extraction or provider call is added.
- `needs-name` is a routing state only; it does not resolve an entity or access a dossier.
- An incomplete specialized intent must not fall through to the generic provider route.
- Existing unknown/locked equivalence, edition-bound citations, completed-through chapter watermarks and before/after progress freshness checks remain unchanged.
- No production annotations, narrative claims, EPUB bytes, XHTML or protected prose are added.

## Tests

The new parser suite covers 13 incomplete Spanish/English prefixes, punctuation after valid names, unrelated prose and control-character rejection. The existing Run 353 evolution suite remains in the CI matrix to reproduce the original failure and verify the fix. Magic-system, dossier, relationship, timeline, evidence-runtime and answer-projection regressions are also included.

## Validation

The dedicated workflow runs focused Vitest suites and strict TypeScript checking on the pull-request merge commit. Run 354 is not considered validated until all steps pass on its final HEAD.
