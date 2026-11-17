# Conversation progress freshness boundary

## Purpose

The strict evidence runtime authorizes claims against a validated v2 reading snapshot. A response can still become stale while an asynchronous selector is pending: the reader may advance, reopen a completed work, or otherwise change the authoritative snapshot before the UI renders the result.

`HoidConversationGateway` closes that presentation gap without changing the evidence runtime or introducing a provider dependency.

## Request lifecycle

1. Validate the request as a plain data record with exactly `question` and `progress`.
2. Validate the supplied v2 snapshot and calculate its canonical progress fingerprint.
3. Read the latest snapshot from the injected `getCurrentProgress` callback.
4. Reject before invoking the runtime if the request snapshot is already stale.
5. Invoke only the strict `HoidCursorEvidenceRuntime`.
6. Read and validate the latest snapshot again after the asynchronous answer completes.
7. Return the answer only if both revision and fingerprint still match. Otherwise discard the answer, text and citations together.

The gateway never calls a model directly, never changes authorization, and never adds narrative text. The injected runtime remains responsible for spoiler checks, approved-claim selection and local rendering.

## UI composition

`HoidScreen` keeps the latest context snapshot in a ref and injects a getter into the gateway. This allows the post-await check to compare against the newest rendered progress rather than the request closure's captured snapshot.

A `progress-changed` result is rendered as a neutral retry message. The stale answer is not appended to chat history.

## Failure behavior

The gateway fails closed when:

- the request has extra keys, accessors, malformed text or no valid snapshot;
- the current snapshot cannot be read or validated;
- the current revision or canonical fingerprint differs before invocation;
- the runtime throws;
- the progress changes while the runtime is pending.

The unavailable result contains only a reason code. It does not include answer text, claim IDs, citations or provider error details.

## Concurrency limitation

This is a stale-response suppression boundary, not cancellation. If progress changes after the strict runtime has already invoked its selector, that selector may finish using the previously authorized candidate set. The gateway discards its result and prevents it from reaching the UI. A future cancellable selector contract could reduce unnecessary in-flight work, but cancellation must not replace the post-completion fingerprint check.

## Source and privacy policy

The gateway accepts only the local v2 progress snapshot and the strict runtime. It does not read EPUB files, store source passages, or transmit private book content. Editorial registries remain source-controlled and empty until original claims have been reviewed.

## Verification

`conversationGateway.test.ts` covers unchanged progress, stale snapshots before invocation, progress changes during an in-flight answer, revision reuse with changed positions, revision changes with identical positions, malformed/accessor requests, invalid snapshots, runtime failures, and control-character input.

The knowledge-graph workflow runs this suite and strict TypeScript checking for the gateway. The screen is wired to the gateway, but device-level Android/iOS interaction and rapid progress-change testing remain release checks.
