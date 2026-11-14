# Cosmere expansion run 74

This run consolidates a reusable, fail-closed domain layer for sources, worlds, works, reading units, progress and spoiler-gated content.

## Provenance

The verified index supplied for `cosmere.epub` is catalog metadata only. Private Roshar EPUBs are not treated as inspected passages merely because they were declared. No protected text is stored here.

A `backed-summary` requires a source explicitly marked `accessible`; metadata-only records cannot carry editorial summaries. This prevents titles or inaccessible private files from being silently converted into invented narrative content.

## Reading and spoilers

Progress is reconciled only from the correct work and known units. Requirements must be non-empty, unique and belong to the target work. Any provenance or requirement ambiguity blocks revelation.

The architecture intentionally keeps world relationships explicit: a title does not imply a world assignment. The priority world registry includes Scadrial, Sel, Nalthis, Taldain and Roshar, while remaining extensible for other worlds.
