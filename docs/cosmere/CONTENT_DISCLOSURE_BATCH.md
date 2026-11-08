# Content disclosure batch

`resolveContentDisclosureBatch(...)` applies the existing disclosure and
anti-spoiler gates to a declared collection of technical content identifiers.

## Contract

A batch is valid only when every evidence record has exactly one request with
the same `contentId`, and neither collection contains duplicate identifiers.
A cardinality or identifier mismatch blocks the entire batch and returns no
partial decisions.

## Safety properties

- The resolver preserves the declared evidence order.
- It delegates each valid pair to the existing evidence and spoiler gates.
- It contains no narrative text, source excerpts, chapter names, or inferred
  editorial structure.
- A batch result does not upgrade evidence or reading progress.
- Invalid mappings fail closed rather than being silently omitted.

This makes batch presentation reusable for multiple worlds and works while
keeping provenance and spoiler authorization independent.
