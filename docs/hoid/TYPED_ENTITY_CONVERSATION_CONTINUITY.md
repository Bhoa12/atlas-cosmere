# Run 137 — typed entity continuity

## Purpose

Run 137 extends the session-local ID-only conversation context with canonical entity kinds. It enables a narrow set of follow-ups such as “¿Y esa organización?”, “¿Y ese objeto?” and “¿Y ese sistema de magia?” without retaining names, aliases or narrative text.

## Context contract

`typedConversationContext.ts` defines a versioned context with:

- two to four canonical entity IDs;
- the exact `HoidKnowledgeKind` for each ID;
- the authoritative SQLite v2 progress revision;
- the exact progress fingerprint.

The context does not store names, aliases, questions, claims, summaries, evidence prose, citations, provider output or source locators. It remains component-local and ephemeral.

## Resolution policy

Only complete, exact, normalized cue phrases are accepted. The supported categories are character, organization, place, object, concept, magic, event and phenomenon. The exact cue “¿Y ese fenómeno?” maps only to the `phenomenon` kind; it does not infer an event or a generic concept. “Sistema de magia” maps only to the canonical `magic` kind. Generic phrases such as “¿Y ese sistema?” are ambiguous and abstain.

A category follow-up resolves only when exactly one entity of that kind exists in the prior context. Zero candidates are unavailable; multiple candidates are ambiguous. The resolver never chooses by recency, position or provider ranking.

## Reauthorization

Before the strict evidence runtime receives the selected ID, the gateway revalidates every ID in the context against the production entity and alias registries using `resolveProductionHoidEntityIds()`. The returned IDs, kinds, order, progress revision and fingerprint must match the context exactly.

The runtime receives the original question and only the one selected canonical ID. It never receives the context, names, aliases, category registry, prior answer or source prose. The final answer still passes through the existing source-aware presentation boundary.

## Progress and lifecycle

The typed context is bound to the exact v2 progress revision and fingerprint. It is cleared when progress changes, when a new unrelated turn replaces the entity scope, on errors, on stale responses, on recommendation/progress routes and when the Hoid screen unmounts.

No context is persisted to SQLite, message history, cloud storage or provider requests.

## Production boundary

The production editorial knowledge, entity alias and approved-claim registries remain the only source of factual authority. This feature adds no Cosmere facts, aliases, topic assignments or source documents. Tests use synthetic IDs and kinds. If a private chapter body is unavailable, no claim is made that it was inspected.

No EPUB bytes, XHTML bodies, protected passages or images are committed.
