# Run 161 — durable progress freshness guard

## Purpose

The cursor-native runtime already validates edition-bound progress and the conversation gateways compare a request snapshot with the coordinator's current snapshot before and after asynchronous work. The previous coordinator getter, however, returned only its in-memory cache. A second coordinator, another app window, or a storage writer outside that instance could advance or correct SQLite while the cached getter remained unchanged.

Run 161 adds an explicit read-through refresh and uses it at the answer and recommendation boundaries. The policy remains fail-closed: if the durable read is unavailable or the snapshot changes while work is in flight, the result is withheld.

## Coordinator contract

`HoidCursorProgressCoordinator.refresh()` is serialized with local cursor mutations. It:

1. waits for an in-flight initial load;
2. reloads the store through `HoidCursorProgressStore.load()`;
3. validates the complete v2 snapshot against the edition-bound cursor manifests;
4. replaces the coordinator cache only after validation;
5. clears the cached snapshot and initialization promise on any unavailable, corrupt or failed read;
6. returns the distinct `operation: "refreshed"` result on success.

It does not create progress, infer completion, advance a cursor or migrate ambiguous positions by dropping them. The underlying store retains responsibility for its transactional SQLite load and v1-to-v2 migration rules.

## Conversation and recommendation boundaries

Both `HoidConversationGateway` and `HoidTopicInterestRecommendationGateway` accept an optional `refreshCurrentProgress` port. When configured, the gateway prefers it over the synchronous cached getter for its freshness checks.

- Answers: refresh before entity/coreference resolution and again after asynchronous claim selection.
- Catalogue recommendations: refresh before and after recommendation composition.
- Topic-interest recommendations: refresh before assignment evaluation and again after any asynchronous approved-claim answer port.
- Reading-context summaries: refresh before and after projection.

The original `getCurrentProgress` callback remains available for synchronous local collaborators such as the relationship gateway. The outer gateway still performs a durable refresh after that route before returning a result.

## UI composition

`CosmereContext` exposes `refreshHoidCursorProgressSnapshot()`. It calls the coordinator's durable refresh, projects the result into React state, and returns the validated snapshot or `null`.

`HoidScreen` uses that port:
- before capturing the request progress for a user question;
- before catalogue recommendations;
- before topic-interest recommendations;
- before and after gateway work through the injected refresh callback;
- once more immediately before committing an answer to chat state;
- once more before committing catalogue or topic recommendation results to UI state.

Thus a result must match the initial request identity, the gateway's durable post-work identity and the final UI-commit read. The render-time filter remains as an additional guard for already displayed progress-scoped messages.

## Consistency rule

A progress identity consists of the validated revision and the fingerprint of its canonical projection. Revision alone is insufficient because a malformed or non-conforming store could return different positions under the same revision.

Any mismatch yields an opaque `progress-changed` or `invalid-progress` result. The gateway never retries against a newer cursor silently; the reader must submit the question again under the new progress state.

## Spoiler guarantees

- A cursor on chapter N still authorizes only through chapter N-1.
- Explicit completion remains separate from cursor position.
- Cross-book evidence must pass each work's own cursor boundary.
- A progress correction or reopening is observed by the next durable refresh.
- No selector, relationship renderer or recommendation composer receives a stale snapshot after the freshness check fails.
- The refresh port carries only the existing progress snapshot; it does not send EPUB text or narrative evidence to a provider.

## Provider and platform separation

The Hoid core depends only on the existing cursor-store and refresh callback contracts. Expo SQLite remains behind `HoidCursorProgressStore`; no SQLite API is imported into the conversation gateways. Providers remain selectors of approved IDs, never authors of answer prose.

## Verification

The dedicated workflow covers:
- coordinator refresh after a second coordinator writes;
- cache invalidation when durable storage becomes unavailable;
- answer withholding when progress changes during asynchronous selection;
- answer acceptance only when both durable reads match;
- topic recommendation rejection when the durable snapshot differs or cannot be read;
- strict TypeScript checks for the coordinator, gateways, screen and context composition.

Tests use synthetic cursors and in-memory stores. They prove the contracts and integration paths, not multi-process SQLite behavior on physical Android/iOS devices.

## Production limitation

The refresh path reads the existing SQLite-backed cursor store and closes stale in-memory-cache gaps within the app's storage boundary. It does not create a cross-device global progress authority or protect SQLite against a malicious backup rollback. Those remain separate infrastructure concerns; neither is required to claim that a normal durable refresh was performed.
