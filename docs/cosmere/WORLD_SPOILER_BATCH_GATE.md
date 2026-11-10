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
