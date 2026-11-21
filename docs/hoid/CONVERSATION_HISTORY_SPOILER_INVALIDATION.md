# Conversation History Spoiler Invalidation

## Problem

A response can be correctly authorized when generated and still become unsafe to display after the reader reopens a work, corrects a cursor backwards, changes editions, or restores another progress snapshot. Clearing recommendation cards alone does not protect assistant messages already present in the chat history.

## Policy

Every narrative answer, reading-context result and catalogue recommendation produced from a ready gateway result is bound to the exact v2 progress identity:

- the coordinator revision;
- the canonical progress fingerprint.

User-authored messages remain visible. Every Hoid message must carry the exact current progress scope, except the single static greeting identified by the fixed `HOID_STATIC_GREETING_ID` and `HOID_STATIC_GREETING_KIND` markers. Unscoped legacy assistant messages are hidden; missing scope is never a compatibility exemption. A present but malformed scope is also hidden.

When the live identity differs, scoped assistant messages are hidden during render and then pruned from component state. User messages remain. This is deliberately conservative: even a forward progress change invalidates old answers instead of trying to prove each answer remains safe under a new state.

## Commit-time check

The UI captures the request identity before dispatch. A ready gateway result supplies its own identity. Immediately before appending the assistant response, the UI compares:

1. request scope;
2. gateway result scope;
3. latest coordinator scope.

All three must match exactly. Otherwise the result is replaced with a neutral stale-progress message.

The gateway's existing before/after check remains mandatory. This UI check closes the additional interval between gateway completion and React state commit.

## Rendering and cleanup

The visible-message filter is applied to the FlatList data on every render, so stale answers are not displayed while an effect is pending. A cleanup pass then removes stale assistant content from component state. The cleanup preserves user-authored messages and only the explicitly marked static greeting. Neutral error notices are scoped to the request snapshot, so they disappear if progress changes. Stale and cancelled results remain unscoped and are therefore hidden.

If the coordinator is unavailable or the snapshot is invalid, no progress-scoped Hoid response is visible.

## Limits

This policy covers the in-memory HoidScreen history. If chat history is persisted in a future release, the persistence schema must store the scope with each assistant message and re-run the same visibility policy on hydration. Persisted chat must never be restored as unscoped assistant prose.

The policy does not retract text already copied, screenshotted, exported, or observed before a user rewinds progress. It prevents subsequent rendering in Atlas; it cannot erase a reader's memory or external copies.

No EPUB text or narrative content is stored by this module.
