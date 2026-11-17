# Conversation Intent Routing

## Purpose

Hoid classifies a valid question into one of the existing evidence-runtime intents before dispatch:

- `explain`: factual or conceptual questions; the strict evidence runtime remains responsible for authorization and abstention.
- `context`: questions about the reader's position or a recap of already completed reading.
- `recommend`: requests for reading suggestions; these are routed to the metadata-only catalogue recommender.

## Determinism and limits

`classifyHoidConversationIntent()` is provider-free and deterministic. It uses a small, version-controlled Spanish cue list after NFKD normalization, accent folding and punctuation normalization.

Recommendation cues take precedence over reading-context cues. Other valid questions default to `explain`.

The classifier does not:
- identify characters or extract aliases;
- infer narrative facts;
- decide whether an answer is spoiler-safe;
- select, approve or unlock editorial claims;
- establish a canonical reading order;
- call an AI provider or retain the question in its result.

A cue match is routing metadata, not evidence. Every answer still passes through the cursor-native evidence runtime and the conversation gateway's before/after progress freshness checks.

## Recommendation dispatch

A question classified as `recommend` is sent to `HoidConversationGateway.recommend()`, not to the narrative answer selector. The returned items are validated against the source bibliography and the live v2 progress snapshot. The UI describes them as unstarted catalogue works and explicitly avoids claiming that their order is canonical or narratively optimal.

## Failure policy

Malformed, blank, oversized, control-character or Unicode-format-character input is rejected before dispatch. Unknown phrasing defaults to `explain`; the evidence runtime may abstain when no approved claim exists. No provider fallback is permitted.

## Future extension

The cue list can be expanded only with regression tests for Spanish phrasing, mixed-intent precedence and malformed input. Entity extraction and alias resolution remain a separate, spoiler-aware stage and must not be inferred from this classifier.
