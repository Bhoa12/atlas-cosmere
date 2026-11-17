# Hoid spoiler-aware entity resolution

## Purpose

`entityResolver.ts` resolves a user-entered name or alias only when both the entity and the alias disclosure are authorized by the current v2 reading snapshot. It is provider-independent and does not generate narrative text.

The production entry point is `resolveProductionHoidEntities(progress, query)`, bound to `HOID_EDITORIAL_KNOWLEDGE` and `HOID_ENTITY_ALIAS_EVIDENCE`. The generic `resolveHoidAuthorizedEntities(knowledge, aliasEvidence, progress, query)` is intended for controlled composition and synthetic tests; production UI must not let a provider supply either registry.

## Separate disclosure scopes

An entity's first appearance and full-summary unlock do not prove that every spelling, epithet, identity or alias is already safe to reveal. Every alias therefore has its own source-controlled record in `entityAliasRegistry.ts`.

Each alias record contains:
- stable alias-record and entity IDs;
- the exact alias string already declared on that entity;
- one or more independent source/unlock evidence items.

Every alias evidence item must have a valid edition-bound locator, a chapter-document SHA-256 allowlist entry and a real unlock unit. Multiple items use AND semantics: all required works and chapters must be completed before that alias can resolve. Alias records cannot invent a spelling that is absent from the entity's declared alias list.

The entity itself must separately pass first-safe-appearance, full-summary unlock, inspected-document and strict catalog validation. Thus entity authorization and alias authorization are two independent gates.

## Resolution policy

- Exact normalized alias matching only; no substring, edit-distance, embedding or provider-generated candidate search.
- Normalization uses Unicode NFKD, removes combining marks and invisible format characters, folds case and collapses whitespace.
- Stored aliases containing control or format characters are rejected.
- Duplicate normalized aliases within one entity are rejected.
- A collision between multiple authorized entities returns `ambiguous`; no first-match choice is made.
- Results are sorted by stable entity ID and bounded to at most ten candidates.
- If the result limit hides additional candidates, the response remains ambiguous and sets `truncated: true`.

## Spoiler boundary and non-disclosure

The resolver validates the v2 snapshot once and uses its completed-through projection. The chapter currently open in Atlas is not treated as completed.

Locked entities and locked alias records are filtered before matching. A locked alias and an unknown alias therefore produce the same `not-found` response. Hidden records do not affect candidate counts, ambiguity, ordering or truncation.

A successful result contains only:
- stable entity ID and kind;
- the one authorized alias that matched;
- the entity's exact source citation;
- every alias-disclosure citation required for that match;
- edition, navigation and inspected-document digests;
- progress revision and fingerprint.

It never returns summaries, the full alias list, a locked alias or source prose. The fingerprint lets the caller discard a result when reading progress changes.

## Failure policy

Malformed queries, non-canonical knowledge, malformed alias evidence, uninspected source documents and invalid progress fail closed. The resolver does not fall back to fuzzy search or legacy numeric progress.

Both production registries are currently empty, so production resolution returns `not-found` until source-backed entities and each of their aliases are independently reviewed and promoted. Synthetic tests validate mechanics only; they do not assert Cosmere facts.

SHA-256 is an integrity check, not proof of author or reviewer identity. Editorial promotion remains a protected source-control operation.


## Natural-language mention preflight

`resolveProductionHoidEntityMentions()` scans exact, whole-word aliases inside a question before the answer runtime is invoked.

The scan is deliberately conservative:

- Every alias in the approved knowledge catalog is considered, including aliases that lack a disclosure record.
- An alias must have its own independently reviewed disclosure record.
- The entity's first-appearance and summary evidence must be unlocked.
- Every alias evidence item must be unlocked (AND semantics).
- A known alias without an approved disclosure record is blocked.
- If a question combines an authorized alias with any blocked alias, the entire question is blocked.
- A blocked result contains no alias, entity ID, source, or indication of which term caused the block.
- Exact Unicode-normalized whole-word matching is used; fuzzy matching and provider-generated candidates are excluded.

`HoidConversationGateway.answer()` runs this preflight after validating the request's progress identity and before calling the evidence runtime. It also verifies that the resolver returned the same progress revision and fingerprint as the request. Resolver errors, blocked aliases and ambiguous authorized matches fail closed.

The preflight is not a substitute for claim authorization. A matched entity only permits the question to proceed to the existing evidence runtime; every answer still requires approved claims and chapter-scoped evidence. The production registries remain empty until original editorial records and alias disclosures have been reviewed.

The UI maps blocked, ambiguous and unavailable mention preflights to the same generic no-authorized-evidence response used for an unknown mention. It does not tell the reader whether a spelling exists, is locked, is ambiguous or lacks a review record.
