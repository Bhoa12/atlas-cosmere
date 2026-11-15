# Cosmere expansion run 102

## Purpose

This iteration adds a conservative catalog-coverage audit. It answers a narrow
question: which declared works have an explicitly accessible reading structure?

## Provenance rules

- A `verified-index` source can support catalog metadata.
- A `declared-private` source can remain in the catalog without implying that
  its text or internal structure has been inspected.
- `editorial-accessible` is required before a reading unit contributes to
  accessible reading structure.

The audit does not infer worlds, chapters, chronology, summaries, or narrative
facts. A title in the catalog is not treated as evidence of any of those things.

## Result

The output reports catalog coverage per work and explicitly distinguishes a
cataloged work from one with accessible reading structure. This lets future UI
and anti-spoiler features remain fail-closed when editorial structure is absent.

## Testing

The accompanying tests use synthetic records only. They verify that private or
index-only sources do not create reading structure and that duplicate or
unknown references are rejected rather than guessed.
