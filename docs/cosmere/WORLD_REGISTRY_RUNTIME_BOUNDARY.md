# World registry runtime boundary

The world registry is a reusable technical layer for Atlas del Cosmere.

## What it contains

- Stable world IDs.
- Display labels for those IDs.
- Runtime validation that rejects malformed, non-canonical, or duplicate entries.

The initial registry exposes the project's priority world identifiers: Scadrial, Sel, Nalthis, Taldain and Roshar.

## What it deliberately does not contain

This boundary does not assert:

- which works belong to each world;
- reading order or chronology;
- chapter structure;
- plot facts, characters or events;
- any text copied from private EPUB sources.

Work-to-world links must remain absent until they are backed by an accessible and verified source. Invalid registry input fails closed and is not normalized or repaired automatically.
