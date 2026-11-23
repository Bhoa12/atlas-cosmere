# Run 267 — race-safe conversation turn lifecycle

## Purpose

Make conversation resets, progress changes, manual cancellation, and new topics safe while an answer is still awaiting local or provider work. A late completion from an obsolete turn must never append a message, restore an old evidence binding, clear the loading state of a newer turn, or overwrite a newly started conversation.

## Design

`createHoidConversationTurnSession()` owns one active turn and issues an opaque, frozen ticket containing only its `AbortSignal`. Ticket identity is held privately by the session; copying or reconstructing the object does not grant ownership.

- `begin()` supersedes and aborts any prior turn before issuing the next ticket.
- `isCurrent(ticket)` checks exact identity and the current epoch.
- `cancelCurrent()` aborts work but deliberately keeps the ticket current so the UI can append a neutral cancellation notice.
- `invalidate()` advances the epoch, aborts work, and removes ownership. Use it for New topic, progress changes, scope changes, external recommendation flows that clear conversational context, and unmount.
- `finish(ticket)` releases ownership only if that exact ticket is still current. An older `finally` block cannot clear a newer turn.

## UI integration rules

`HoidScreen` starts the ticket before its first asynchronous progress refresh. It checks ticket ownership after each awaited operation and before every conversational state commit. Stale turns return without touching messages or loading state. The `Nuevo tema` action remains available during a pending request and invalidates that request immediately.

Manual cancellation differs from reset: it aborts the current signal but preserves ticket ownership long enough to show a spoiler-neutral cancellation message. A reset or progress change invalidates ownership, so no message from that old turn is committed.

## Safety and privacy

- Tickets and signals remain in memory; they are not serialized, persisted, or sent to providers.
- Invalidating a turn does not change the SQLite reading ledger or unlock any chapter.
- Every answer still passes the existing progress fingerprint, evidence presentation, citation, and spoiler checks.
- EPUB text, XHTML, locators, and local file handles are not added to this coordinator.
- A non-cooperative adapter may continue its own internal work, but its obsolete result cannot mutate the conversation UI.

## Validation

The focused Vitest suite covers supersession, stale-finally isolation, reset/progress invalidation, manual cancellation semantics, forged tickets, and idle cleanup. The dedicated GitHub Actions workflow also runs strict TypeScript over the coordinator and `HoidScreen`.
