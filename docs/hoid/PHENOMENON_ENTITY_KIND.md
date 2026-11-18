# Run 138 — phenomenon entity kind and taxonomy alignment

## Purpose

Run 138 adds `phenomenon` as a first-class `HoidKnowledgeKind`. It is distinct from `event` (a bounded occurrence) and `concept` (an abstract knowledge item). The reviewed topic taxonomy already contains a separate `phenomenon` topic; this change aligns entity typing, editorial staging, graph validation and typed conversational continuity without creating any topic assignments.

## Contract changes

The canonical kind union now includes:

- `character`
- `place`
- `event`
- `phenomenon`
- `concept`
- `magic`
- `organization`
- `object`

All runtime allow-lists must agree, including the strict evidence runtime: editorial entity drafts, atomic claim subjects, entity resolution, knowledge graph nodes, relationship gateway validation, topic evidence validation, typed conversation context and conversation gateway reauthorization.

## Conversation behavior

The exact Spanish follow-up “¿Y ese fenómeno?” resolves to `phenomenon` only when the ephemeral typed context contains exactly one entity of that kind and its progress revision/fingerprint remain current. The gateway reauthorizes every context ID against production entity and alias registries before the strict runtime receives the single selected canonical ID.

No fuzzy matching, positional selection, provider-based inference or fallback is permitted. Missing, stale, blocked or ambiguous references abstain.

## Topic taxonomy boundary

The `phenomenon` topic and the `phenomenon` entity kind are independent contracts. A phenomenon entity may be a topic-assignment subject only when it exists in the approved identity registry and the assignment's claim/evidence are verified and reviewed. This run does not add production assignments.

## Evidence and privacy

Tests use synthetic identifiers and original synthetic statements. No private EPUB body, XHTML passage, protected text, image or unverified narrative fact is added. No production knowledge, alias, relationship or topic registry is modified.

## Validation

The dedicated workflow runs typed context/gateway, entity resolver, relationship gateway, knowledge graph, editorial entity/claim staging and topic taxonomy suites, followed by strict TypeScript checks including `HoidScreen.tsx`.
