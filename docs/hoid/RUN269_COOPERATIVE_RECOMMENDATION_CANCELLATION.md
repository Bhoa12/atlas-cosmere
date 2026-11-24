# Run 269 — cooperative recommendation cancellation

## Objective

Propagate the recommendation request ticket's AbortSignal beyond the screen so invalidated work stops waiting promptly and cooperative local adapters can stop between units of work.

## Changes

- Adds abortableOperation.ts, a provider-neutral await boundary that rejects promptly on abort while keeping handlers attached to the underlying promise. Late adapter rejections remain observed.
- Adds cancelCurrent() to the recommendation request session. It invalidates the exact active ticket, aborts its signal, releases the slot and lets the UI start a new request.
- Exposes an explicit **Cancelar recomendaciones** action in HoidScreen. It clears pending recommendation presentation and never displays partial results.
- Passes the same ticket signal to the topic-interest recommendation gateway and the signed recommendation presenter.
- The topic gateway passes the signal to durable progress readers and approved-claim ports, checks cancellation between validation/composition stages and returns the explicit cancelled result.
- The local approved-claim port checks the signal before projection and between claim renders. Cancellation discards the whole batch rather than returning partial claims.
- The trusted topic presenter passes the signal to progress, claim-loading and trusted-presentation boundaries, and checks it between every claim.
- The trusted screen answer port stops waiting for a signed presenter result when the request is cancelled and withholds the result.

## Cancellation guarantees and limits

There are three distinct guarantees:

1. **Prompt caller release:** awaitHoidOperationWithSignal() stops the recommendation caller waiting after abort.
2. **Cooperative local cancellation:** the topic gateway, local approved-claim renderer and presenter stop at their next explicit signal check.
3. **Adapter-internal cancellation:** an adapter only stops its own underlying work if it consumes the optional signal. A legacy progress reader or signed presenter that ignores the signal may continue internally; its late result is observed and discarded. This run does not claim physical interruption of non-cooperative native or synchronous work.

The signal and request ticket remain in memory only. They are never serialized, persisted, sent to a language provider or included in recommendation data.

## Safety invariants

- Progress revision and fingerprint checks remain mandatory before and after recommendation work.
- Signed editorial assignments and the trusted presentation port remain the only factual authority.
- Cancellation returns no partial recommendation set, citations or trust metadata.
- Cancellation does not change SQLite progress, unlock chapters or alter the bibliography.
- The catalogue recommendation path also races its durable progress reads against the same request signal before committing UI state.
- Private EPUB bytes, XHTML, chapter text, locators and file handles are not added to any gateway contract.

## Tests

- Abort before operation start.
- Prompt cancellation while an adapter promise is pending.
- Late rejection after abort remains observed.
- Normal completion before abort.
- Session cancellation releases only the active ticket.
- Topic gateway cancellation before a progress read and during a pending durable refresh.
- Local claim rendering stops between claims.
- Trusted topic presentation returns a cancellation result while claim loading is pending and ignores the late result.

All fixtures are synthetic; no private EPUB content is used.