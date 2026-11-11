# Reading Unit Registry Runtime Boundary

## Purpose

`readingUnitRegistry.ts` provides a reusable technical model for reading
checkpoints across every world and work in Atlas del Cosmere.

A reading unit contains only:

- a stable technical ID;
- the technical ID of its work;
- a display label;
- a positive technical position.

The registry is intentionally agnostic about chapters, pages, chronology and
narrative content.

## Fail-closed validation

Runtime validation rejects the entire registry when it contains malformed
entries, non-canonical identifiers, invalid positions, duplicate unit IDs or
duplicate positions within the same work. Consumers receive no partial registry.

## Editorial boundary

A unit label or position does not prove an editorial division. Verified chapter
or section metadata must be introduced by a separate source-backed layer.

This module does not read EPUB text, reproduce protected passages, or infer
facts from unavailable material.

## Integration

The stable unit IDs are suitable for:

- reading progress;
- anti-spoiler requirements;
- future work-to-world views.

Those consumers should validate their own runtime inputs and must not treat a
technical relationship as an editorial or canonical assertion.
