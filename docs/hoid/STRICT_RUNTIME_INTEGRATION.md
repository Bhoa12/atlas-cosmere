# Strict Hoid runtime in the application screen

The Hoid screen must use `HoidEvidenceRuntime`, not the legacy free-text
`HoidService` path. The selector is allowed to return IDs only; final text
must come from approved original-editorial claims stored locally.

## Current production state

`editorialRegistry.ts` is the composition point for production knowledge. It
currently contains no knowledge entries and no approved claims because the
private EPUB passages are not available for fresh verification in this run.
Consequently, the screen must abstain with an explicit message. It must not
fall back to a free-form model or generic plot knowledge.

## Adding editorial material

Each knowledge entry must include a verified source work, chapter and opaque
locator, plus an independent unlock threshold. Each claim must be original
editorial prose, reviewed, and linked to one or more knowledge evidence IDs.
Cross-work claims are safe only when every linked evidence item is authorized
for the reader's current position.

## Regression requirements

- Empty registry: abstain and return no citations.
- Empty candidate set: do not invoke the selector.
- Selector output: IDs only; no free-form model prose is rendered.
- Screen integration: no legacy free-text service is used.
