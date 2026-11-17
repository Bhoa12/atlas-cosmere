# Conversation Intent Routing

## Purpose

Hoid classifies a valid question into a deterministic local mode before dispatch:

- `catalogue-recommendation`: requests for reading suggestions; routed to the metadata-only catalogue recommender.
- `reading-progress`: requests such as “where did I leave off?”; answered from the validated SQLite v2 cursor snapshot only.
- `narrative-context`: requests for a plot recap; routed to the strict editorial evidence runtime and therefore abstains until approved claims exist.
- `explanation`: factual or conceptual questions; routed to the strict editorial evidence runtime.

The public evidence-runtime intent remains one of `recommend`, `context` or `explain`. The separate mode determines which local capability is used.

## Determinism and limits

`classifyHoidConversationIntent()` is provider-free and deterministic. It uses a version-controlled Spanish cue list after NFKD normalization, accent folding and punctuation normalization.

Recommendation cues take precedence over narrative recap cues, which take precedence over progress-position cues. Other valid questions use `explain`.

The classifier does not:
- identify characters or extract aliases;
- infer narrative facts;
- decide whether an answer is spoiler-safe;
- select, approve or unlock editorial claims;
- establish a canonical reading order;
- call an AI provider or retain the question in its result.

A cue match is routing metadata, not evidence.

## Progress-position mode

`reading-progress` calls `HoidConversationGateway.readingContext()`. That operation validates the authoritative v2 snapshot, projects every position through the same exclusive chapter boundary used by spoiler authorization, and checks progress freshness before and after projection.

For a cursor on chapter N, the result reports N as the open chapter and N-1 as the last completed chapter. Chapter one reports no completed chapter. Explicit completion reports the whole work without inventing a final chapter number.

This is metadata about the reader's own progress, not a plot recap. The UI labels it accordingly. Only verified numbered-chapter units are represented.

## Recommendation dispatch

A `catalogue-recommendation` request is sent to `HoidConversationGateway.recommend()`, not to the narrative claim selector. Returned items are validated against the source bibliography and the live v2 progress snapshot. The UI describes them as unstarted catalogue works and explicitly avoids claiming that their order is canonical or narratively optimal.

## Narrative recap and explanation

A `narrative-context` or `explanation` request still passes through the strict evidence runtime. It may answer only from approved editorial claims with authorized evidence. If the registry has no suitable approved claim, Hoid abstains.

## Failure policy

Malformed, blank, oversized, control-character or Unicode-format-character input is rejected before dispatch. No provider fallback is permitted. Every asynchronous answer or recommendation is subject to the gateway's before/after progress freshness checks.
