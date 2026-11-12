# Reading Progress Runtime Boundary

This module represents technical reading progress only.

It validates a declared work identifier and a set of completed unit identifiers against an external registry. The module is deliberately **fail-closed**: unknown works, unknown units, malformed identifiers and duplicates are rejected.

## What it does not establish

This boundary does not define or infer chapters, pages, publication order, chronology, world membership, characters, events or narrative facts. A reading unit may only be registered when its structure is independently verified and available to the application.

## Integration path

`source metadata -> work -> verified reading units -> validated progress -> spoiler gate`

The bibliography supplied for private EPUB sources can therefore be catalogued as metadata without copying protected text or treating inaccessible passages as inspected content.
