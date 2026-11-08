# Declared content scope

`resolveDeclaredContentScope` validates the structural boundary between technical content identifiers and the worlds and works already declared by the catalog model.

## Contract

Each entry must explicitly provide:

- `contentId`
- `workId`
- `worldId`

The resolver never infers relationships from titles, chronology, filenames or narrative knowledge.

## Fail-closed behavior

The scope is blocked when declarations are empty or duplicated, an entry is malformed, a content identifier is duplicated, or an entry points outside the declared work/world sets. A blocked result returns no usable entries while preserving diagnostic identifiers.

## Editorial boundary

This module contains no narrative text, chapter structure or claims about source passages. A valid structural scope does not grant spoiler authorization or evidence for a summary; those remain independent gates.
