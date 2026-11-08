# Declared work binding scope

`resolveDeclaredWorkBindingScope` checks that explicit `sourceId -> workId`
relationships remain inside the set of works declared by the active reading
model.

## Why this exists

Coverage and provenance are separate concerns. A source binding can be
structurally valid while still targeting a work that the current reading model
does not declare. Silently ignoring that relationship would make expansion
state harder to audit.

The resolver therefore fails closed when any binding is out of scope and
returns the offending bindings separately for diagnostics.

## Non-goals

This check does not:

- infer a work from a source title or collection;
- add worlds, chronology, chapters, or reading units;
- prove that a private EPUB was read or that narrative content is accessible;
- authorize spoiler-sensitive content.

It is a structural guard intended to compose with the source catalog,
provenance, reading-progress, and spoiler gates.
