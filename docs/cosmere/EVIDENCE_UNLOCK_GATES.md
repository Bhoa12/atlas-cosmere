# Evidence unlock gates

This module provides a reusable, fail-closed gate for spoiler-sensitive Atlas content.

A gate unlocks only when every declared requirement:

1. has a non-empty evidence identifier;
2. appears exactly once among structurally valid records;
3. is marked `verified` with a non-empty source and locator.

Empty requirements, duplicate requirements, missing evidence, declared-only evidence, malformed records, and ambiguous evidence all keep the gate closed.

The gate does not inspect EPUB prose or infer narrative facts. It evaluates only structured evidence supplied by other verified layers. A declared source is not, by itself, sufficient to unlock editorial content.
