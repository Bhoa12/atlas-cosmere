# Hoid spoiler-aware entity resolution

## Purpose

`entityResolver.ts` resolves a user-entered name or alias only against editorial entries that are safe at the current, validated v2 reading boundary. It is provider-independent and does not generate narrative text.

The production entry point is `resolveProductionHoidEntities(progress, query)`, which is bound to `HOID_EDITORIAL_KNOWLEDGE`. The generic `resolveHoidAuthorizedEntities(knowledge, progress, query)` is intended for controlled composition and synthetic tests; application production code must not let a provider supply its own knowledge registry.

## Resolution policy

- Exact normalized alias matching only; no substring, edit-distance, embedding or provider-generated candidate search.
- Normalization uses Unicode NFKD, removes combining marks and invisible format characters, folds case and collapses whitespace.
- Stored aliases containing control or format characters are rejected.
- A duplicate alias within one entry after normalization invalidates the knowledge batch.
- The optional `kind` filter narrows only already-authorized entries.
- A collision between multiple authorized entries returns `ambiguous`; no first-match choice is made.
- Results are sorted by stable entity ID and bounded to at most ten candidates.
- If the result limit hides additional candidates, the response remains ambiguous and sets `truncated: true`.

## Spoiler boundary

The resolver validates the v2 snapshot once and uses its completed-through projection. The chapter currently open in Atlas is not treated as completed.

An entry is considered only when all of the following hold:

1. Its canonical metadata shape is valid and marked `verified`.
2. Its first-safe-appearance unit matches the exact source work and chapter.
3. Its source locator matches the edition reading manifest.
4. The exact source chapter has an individual document SHA-256 allowlist entry.
5. Its full-summary unlock threshold is valid and independently satisfied.
6. The entry passes the strict evidence runtime's catalog validation.

Locked entries are filtered before aliases are matched. A locked alias and an unknown alias therefore produce the same `not-found` response and the hidden entry cannot affect ambiguity, candidate counts or ordering.

## Output boundary

A successful result contains only:

- stable entity ID and kind;
- the one authorized alias that matched;
- exact source citation metadata;
- edition, navigation and inspected-document digests;
- progress revision and fingerprint.

It never returns the summary, the full alias list, a locked entity, or source prose. The fingerprint lets the caller discard a result when reading progress changes.

## Failure policy

Malformed queries, non-canonical knowledge, uninspected source documents and invalid progress fail closed. The resolver does not fall back to fuzzy search or legacy numeric progress.

The current production editorial registry is empty, so production resolution returns `not-found` until source-backed entries are independently reviewed and promoted. Synthetic tests validate mechanics only; they do not assert Cosmere facts.

SHA-256 is an integrity check, not proof of author or reviewer identity. Editorial promotion remains a protected source-control operation.
