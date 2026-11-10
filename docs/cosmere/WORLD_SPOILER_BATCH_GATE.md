# World spoiler batch gate

`resolveWorldSpoilerBatchGate` evaluates multiple metadata-only content requests against one already-declared world reading frontier.

## Guarantees

- A request must belong exactly to the requested `worldId`.
- Content identifiers must be canonical and unique within a batch.
- Reading positions must be positive integers and remain inside the declared range when one is supplied.
- Invalid or ambiguous metadata blocks the entire batch.
- Before a world has started, no request is revealed.
- During reading, only requests at or behind the validated frontier are returned.

This module carries no passages, chapter text, summaries or canon assertions. A returned identifier is only an access decision; editorial content remains outside this layer.

## Complete-frontier contract

A `complete` frontier is valid only when the batch also declares the total number of positions and the safely completed count matches it exactly. This prevents a caller from labelling an incomplete or unbounded frontier as complete and exposing content beyond the validated reading boundary.

The gate remains metadata-only: authorization of a content identifier never imports, stores, or implies protected EPUB text or additional canon claims.
