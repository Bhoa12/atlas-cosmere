# Catalog-world reference runtime boundary

This boundary validates technical references between the bibliographic source catalog and the world registry.

It deliberately does **not** decide that a work belongs to a world. A relationship may be represented only when supported by verified project metadata. Consequently, an empty `worldIds` list is valid and means “no relationship is asserted here”.

The validator is fail-closed:

- malformed catalog collections are rejected;
- malformed or duplicate world identifiers are rejected;
- every declared world reference must resolve to a registered world;
- unknown references are blocked rather than guessed.

The module contains no book text, chapter text, plot summary, chronology, or narrative facts.
