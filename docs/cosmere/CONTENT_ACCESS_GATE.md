# Content Access Gate

`resolveContentAccessGate` is the final metadata-only boundary before an application displays editorial content.

## Inputs

- A validated reading-progress snapshot.
- Spoiler visibility decisions produced from an independently reviewed requirement map.
- Explicitly requested content identifiers.

## Fail-closed behavior

Access is denied when progress is blocked, visibility metadata is malformed or ambiguous, or requested content has no visibility record.

An allowed decision means only that the metadata permits access. It does **not** verify prose, establish canon, prove that a private EPUB was read, or make content spoiler-safe by itself.

## Editorial boundary

This module deliberately contains no excerpts, summaries, chapter text, or narrative facts. Any editorial material must remain independently authored and backed by accessible sources before being associated with a content identifier.
