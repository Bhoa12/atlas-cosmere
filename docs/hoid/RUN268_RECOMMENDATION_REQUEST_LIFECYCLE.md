# Run 268 — recommendation request lifecycle

## Problem

The topic-interest recommendation flow performed its first durable progress refresh before setting the shared loading state and before entering its try/catch/finally. Two rapid invocations could therefore pass the React-state guard and dispatch duplicate work. A rejected initial refresh could also escape the handler without a neutral UI message. Neither recommendation path had an operation identity, so a stale completion could still update recommendation state after a progress or trust-context change.

## Design

The createHoidRecommendationRequestSession coordinator provides one in-memory request slot shared by catalogue and topic-interest recommendations.

- begin() synchronously acquires the slot and returns null if another request already owns it.
- isCurrent(ticket) checks exact ticket identity and the current epoch.
- invalidate() aborts the ticket signal and removes ownership on progress changes, trust-port changes, topic-selection changes and unmount.
- finish(ticket) releases the slot only for its current owner, so an old finally cannot clear a newer request's loading state.
- Both handlers set the loading state before their first await and place the complete asynchronous path inside try/catch/finally.
- Each handler checks ticket ownership after every await and before committing results or error messages.
- Topic recommendations capture the selected topic IDs once and use that immutable snapshot for context creation and presentation identity.

## Cancellation boundary

The ticket exposes an AbortSignal, and invalidation aborts it. Current recommendation gateways and the signed presenter do not accept a signal, so this run guarantees logical invalidation and stale-result suppression, not physical interruption of their internal work. This limitation is explicit; no cancellation capability is claimed for adapters that do not implement it.

## Spoiler and privacy guarantees

- The existing durable progress refresh, revision/fingerprint checks and signed editorial presenter remain mandatory.
- A stale request cannot publish recommendations, citations or trust metadata after progress or selection invalidation.
- No recommendation operation changes the reading ledger or unlocks a chapter.
- No EPUB, XHTML, local locator, chapter text or private file handle is added to the request session.
- The request ticket and signal are never serialized or sent to a provider.

## Validation

The dedicated workflow runs the request-session unit suite and strict TypeScript over the coordinator and HoidScreen. Device-level behavior and physical cancellation inside non-cooperative adapters remain outside this workflow.
