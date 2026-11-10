# World Spoiler Batch Gate

`resolveWorldSpoilerBatchGate` is a metadata-only boundary for evaluating a batch of content identifiers against a validated reading frontier for one world.

## Fail-closed contract

The entire batch is blocked when any structural input is ambiguous or malformed. The gate validates canonical world and content identifiers, duplicate content IDs, safe integer positions, declared-position bounds, and consistency between the frontier status and completed-position count.

Runtime values are validated defensively even when TypeScript types declare them as strings or numbers. This prevents malformed external or persisted data from being silently authorized.

A `complete` frontier requires an explicit declared total and an exact equality between completed and declared positions.

## Scope

The gate never stores or inspects EPUB text, chapter text, quotations, summaries, or canon facts. An allowed identifier is only a technical access decision; editorial content remains outside this layer and must have its own provenance and spoiler validation.
