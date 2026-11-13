# Hoid IA — executable recommendation boundary

`recommendationContract.ts` implements the recommendation rules without loading
narrative passages or chapter summaries.

## Allowed reasons

A recommendation is authorized only when every reason is independently verifiable
against one of these inputs:

- the immutable reading-progress snapshot;
- an explicit reader preference;
- non-narrative catalogue metadata.

The provider may later help phrase an already authorized recommendation, but it
must not invent or supply the factual basis used to authorize it.

## Spoiler rule

Progress is checked per work and chapter. A reason referring to a chapter beyond
the snapshot is rejected even if the work exists in the catalogue.

## Fail closed

Candidates with no reasons, unknown preferences, invalid progress positions or
metadata that cannot be found are returned as `blocked`. The boundary does not
consult external narrative knowledge as a fallback.

## Private sources

This module stores no EPUB text. The supplied Cosmere and Roshar bibliography is
a catalogue of sources and reading structure only. Any future ingestion layer must
provide original summaries with explicit provenance separately; inaccessible
passages must remain unavailable rather than being inferred.
