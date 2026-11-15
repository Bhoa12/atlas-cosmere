# Narrative Pipeline

`prepareNarrativePipeline` is the provider-independent handoff between Hoid IA's safety boundary and any future generation adapter.

## Contract

The pipeline accepts a reader request plus candidate evidence and delegates authorization to `buildSafeContext`.

Only when authorization succeeds does it expose:

- the explicit question and intent;
- one catalogued source;
- the reader's maximum authorized chapter;
- evidence from that exact source at or before that chapter.

Future chapters and evidence from another source never reach the returned context. If no evidence survives, the result is an explicit failure rather than a fallback to general model knowledge.

## Provider boundary

This module does **not** call an AI provider. A provider adapter should consume only the successful pipeline result and should not expand the source, chapter limit, or evidence set.

## Copyright boundary

Evidence summaries must be original summaries. The pipeline stores and forwards metadata and authorized summaries only; it does not ingest or reproduce full EPUB text.

## Failure policy

The pipeline is fail-closed:

- invalid requests return `invalid-request`;
- missing authorized evidence returns `no-authorized-evidence`.

Callers should turn either failure into the project's structured abstention path instead of generating a narrative answer.
