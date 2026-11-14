# EXPANSION RUN 69

This iteration adds a deterministic reading-plan and progress-audit layer.

## Scope

The layer works from explicit reading-unit metadata only. It does not infer chapters, sections, worlds, chronology, or narrative facts from a title or a private EPUB declaration.

## Safety properties

- A reading plan is sorted by explicit positions.
- Duplicate positions make the plan ambiguous and return an empty plan.
- Progress from another work is ignored.
- Unknown unit IDs are ignored.
- Spoiler gates fail closed when requirements are empty, duplicated, unknown, or not backed by an unambiguous plan.
- The catalog policy distinguishes verified index metadata, declared private sources, and editorial content backed by accessible material.

## Bibliography boundary

The verified `cosmere.epub` index may be used for the titles supplied by the user. Private Roshar EPUBs remain catalog sources without implying that their internal passages or structure were consulted. No protected text is copied by this layer.

## Tests

Tests use synthetic units and progress snapshots only; they do not embed or reproduce source text.
