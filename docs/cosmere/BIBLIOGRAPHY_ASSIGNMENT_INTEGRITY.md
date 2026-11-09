# Bibliography Assignment Integrity

`resolveBibliographyAssignmentIntegrity` checks that independently declared
source-to-work and source-to-world metadata only reference known catalog sources
and do not contain duplicate source declarations within either relationship.

This boundary is deliberately metadata-only. A valid result does not establish
that a private EPUB was read, does not infer editorial facts, and does not
authorize spoilers or narrative disclosure.

The resolver is fail-closed: unknown, empty, or duplicated identifiers block the
result instead of being repaired through title matching or external knowledge.
