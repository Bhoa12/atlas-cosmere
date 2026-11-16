# Atlas chapter-change authorization

## Default chapter action

The ordinary `setCapituloLibro` API is a forward-only progress action. It calls the coordinator without the optional `allowRegression` or `reopenCompleted` flags.

This is intentional: a general context method must not silently turn every chapter update into permission to rewrite history or reopen a completed work.

## Corrections and reopening

- Advancing to a later chapter is accepted when the edition policy permits that numeric cursor.
- Moving backwards is rejected by the ledger with `regression-requires-confirmation`.
- Setting a chapter on a completed work is rejected with `already-completed`.
- Reopening a completed numeric work remains the dedicated "mark unread" action, which persists chapter 1.
- A future arbitrary-cursor correction UI must be a separate action, show an explicit confirmation to the reader, and invoke the coordinator's correction option only after confirmation.

The context setter returns the coordinator result so callers can distinguish an accepted update, a rejected correction, a conflict and an unavailable store. It must not report a rejected write as saved.

## Tests

`atlasProgressActions.test.ts` verifies that the default Atlas action can advance, cannot regress without confirmation, and cannot reopen a completed work. The test uses the real coordinator and a deterministic in-memory store; it does not claim to test native SQLite.
