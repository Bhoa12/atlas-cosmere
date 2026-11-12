# Source catalogue boundary

`src/data/sourceCatalogue.ts` is the bibliographic entry point for future Cosmere expansion.

## What it stores

Only metadata explicitly available to this project:

- a stable technical work identifier;
- the displayed title;
- the source package that supports the record;
- the provenance state of that source package.

The current `cosmere-epub` records come from the verified index supplied with the project request. The Roshar package is marked `declared-private`: its existence is known, but this module does not claim that its internal text or table of contents was inspected here.

## What it deliberately does not do

This boundary does not:

- copy EPUB text;
- create chapter or page structure;
- assign works to Scadrial, Sel, Nalthis, Taldain, Roshar, or another world by inference;
- establish chronology or reading order;
- contain narrative summaries or facts.

Those concerns belong in separate registries and should only be populated from accessible, verified metadata.

## Extension path

The intended dependency flow is:

`source catalogue -> explicit work/world metadata -> verified reading units -> user progress -> spoiler access`

Every downstream layer should validate references rather than silently guessing. Unknown or malformed metadata should remain unavailable to anti-spoiler reveal logic.
