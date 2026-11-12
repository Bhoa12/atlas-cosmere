# Cosmere expansion boundary

This module is infrastructure for catalogue metadata, reading units, progress, and spoiler gates.

## Source boundary

`verified-index` records metadata backed by a verified catalogue index. `declared-private` records a private source whose existence is known without claiming that its internal passages were inspected.

The module must not store EPUB text, quotations, chapter prose, or fabricated editorial facts.

## World boundary

World identifiers are reusable navigation metadata. A world name does not, by itself, assign any work to that world. Work-to-world relationships must be introduced separately with explicit, supported metadata.

## Reading and spoilers

Reading units are structural records. Visibility is fail-closed: empty requirements, duplicate requirements, missing progress, or incomplete progress keep content locked.

Editorial summaries and spoiler requirements must be supplied by a backed editorial layer; this infrastructure does not infer narrative facts.