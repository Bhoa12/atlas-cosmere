# Catalogue relation boundary

This layer records only explicit, source-backed technical relations between a registered work and a registered world.

## Guarantees

- A relation must name an existing work, world, and source.
- Duplicate or malformed relation identifiers are rejected.
- Lookup never infers a world from a title, filename, chronology, or narrative knowledge.
- An unknown or malformed lookup returns no relation.

## Editorial boundary

The private bibliography can establish that listed works exist in the source catalogue. It does not, by itself, authorize this layer to invent work-to-world mappings. Such mappings must be added separately with an explicit source identifier whose supporting metadata is available and verified in the project.

This module stores no protected text, quotations, chapter contents, or narrative summaries. It is intended to sit upstream of reading units, progress, and anti-spoiler gates:

source provenance -> explicit catalogue relation -> reading units -> progress -> visibility.
