# Reading-unit registry

This module defines a reusable structural registry between a declared work and explicit reading units.

## Guarantees

- A unit belongs to a declared work by explicit `workId` only.
- Unit identifiers are globally unique.
- Positions are unique within each work and are non-negative integers.
- Results are deterministic.
- Invalid input blocks the registry instead of returning partial authorization.

A position is **not** interpreted as a chapter, part, scene, page, or other editorial subdivision. Labels are optional metadata and are never used to infer missing units.

This registry does not prove that a private source was read, that a passage is available, or that narrative content may be revealed. Anti-spoiler authorization must remain a separate explicit step.
