# Progress snapshot boundary

A Hoid response must be authorized against one canonical progress snapshot.

## Rule

The request boundary validates and canonicalizes progress once. The resulting snapshot is treated as immutable for the rest of the response pipeline.

The same snapshot must drive:

1. editorial-record authorization;
2. evidence allow-list construction;
3. provider context selection;
4. response verification;
5. decision receipts.

A provider result, recommendation, retry, or later pipeline stage must not reread mutable progress and silently obtain a higher authorization ceiling.

## Safe failure

If the snapshot cannot be created, Hoid abstains. If a later component cannot prove that its context belongs to the request snapshot, that context is rejected.

## Why this matters

Progress is an authorization input, not merely personalization data. Recomputing it after an asynchronous provider call can create a time-of-check/time-of-use gap: a concurrent progress update could authorize narrative information that was not available when the reader asked the question.

This policy uses metadata and authorization state only. It does not require storing or exposing private EPUB passages.