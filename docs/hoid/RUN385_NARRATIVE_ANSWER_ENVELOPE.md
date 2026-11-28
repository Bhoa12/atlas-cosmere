# Hoid IA Run 385 — canonical narrative response envelope

## Objective

Unify the final, UI-safe representation of a verified narrative answer without replacing the specialized evidence engines, route adapters, trusted presenter, or recommendation navigation boundary.

## Contract

The module src/hoid/narrativeAnswerEnvelope.ts defines:

- HoidNarrativeAnswerEnvelope: a ready answer bound to one exact progress revision/fingerprint, a stable narrative domain, and an optional canonical book scope.
- HoidNarrativeAbstentionEnvelope: a typed abstention with a stable reason code and fixed safe copy. It does not accept caller/provider-generated prose.
- HoidNarrativeResponseEnvelope: the discriminated union for the two states.
- resolveHoidNarrativeDomain: a closed mapping from the six supported narrative routes to stable presentation domains.
- createHoidNarrativeAnswerEnvelope and createHoidNarrativeAbstentionEnvelope: strict, immutable constructors.

A ready envelope carries only:
- original display text;
- canonical bibliography work IDs and titles;
- verified chapter number, chapter ordinal and ambiguity marker;
- per-segment citations and editorial epistemic kind;
- optional, revalidated cross-work chapter matrix;
- a derived count of segment epistemic kinds.

It deliberately excludes evidence IDs, EPUB locators, unlock thresholds, provider payloads, prompt material, credentials, raw passages and confidence scores.

## Validation rules

1. Progress identity must pass the existing HoidConversationProgressScope validator.
2. Domain and route mapping are closed sets; unknown routes fail closed.
3. Explicit book scope must pass canonicalizeHoidAnswerBookScope; every citation must remain inside it.
4. Work title must match the metadata-only bibliography.
5. Chapter number and ordinal must identify a unit in the verified reading manifest; ambiguity must match the manifest.
6. Segment citations must be members of the top-level citation set. Every top-level citation must be referenced by a segment when segmentation is present.
7. Claim IDs are unique. Epistemic labels are derived from approved classification metadata and mismatched labels are rejected. Missing classification remains unclassified; it is never promoted to a factual assertion.
8. Segment layout is an exact closed union. A layout without segments, or segments without layout, is rejected.
9. A cross-work matrix must match the exact canonical works and chapters projected from the same citations and segments.
10. Abstention text is selected from a fixed reason-code map. Arbitrary text and unknown reason codes are rejected.

The contract intentionally does not infer a numeric confidence value. Editorial epistemic classification is not a calibrated probability.

## HoidScreen integration

HoidScreen now creates a canonical envelope only after the existing route-specific adapter/presenter has returned its display projection and the existing final progress checks have completed.

The chat message stores one answerEnvelope for narrative citations, segments, layout and cross-work provenance. Rendering no longer reads loose citas, segmentos, formato or evidenciaTransversal message fields.

If any provenance-bearing field exists but the envelope cannot be constructed, Hoid discards the narrative text, citations, follow-up suggestions and context links, clears the in-memory context bindings, and emits a neutral validation notice scoped to the current request snapshot.

The message-level progressScope remains for the existing stale-history filter. It is the same snapshot carried inside the envelope.

Follow-up questions remain a separate typed, progress-bound field because their selection flow has its own citation and draft validation. Edition/topic recommendations retain their existing signed presenter and independently revalidated navigation handoff; they are not flattened into a narrative answer.

## Trust boundaries

- Specialized dossier, relationship, timeline, character-evolution, magic-system and trusted conversation engines remain authoritative for evidence authorization and spoiler unlocks.
- The envelope is a final display-contract validator, not an evidence authorizer.
- It does not read EPUB/XHTML, select a provider, invoke a model, persist chat history or change reading progress.
- A progress change still invalidates the response before the envelope is committed.
- No source passage is included in this change.

## Bibliography and copyright

The existing 24-work catalogue remains metadata-only: 17 entries from cosmere.epub and seven Roshar EPUB entries. No private EPUB bytes, extracted text, XHTML or copyrighted passages were copied or uploaded. Tests use synthetic original prose and the existing chapter-index metadata only.

## Validation

The dedicated workflow runs:
- narrativeAnswerEnvelope.test.ts;
- trustedScreenIntegration.test.ts;
- strict TypeScript for the envelope, its tests, and HoidScreen.tsx.

The run is considered validated only when all workflow jobs complete successfully on the final branch HEAD.
