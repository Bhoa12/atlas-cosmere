# Spoiler gates

This module provides a conservative contract for deciding whether a piece of
application content may be exposed.

A gate contains only metadata:

- a stable gate ID;
- the work whose progress is relevant;
- an explicitly declared reading position.

The gate opens only when progress for **that same work** contains the required
position. Progress from another work never unlocks it.

The domain layer deliberately does not infer gates from titles, summaries,
characters, or source text. Invalid or incomplete gate metadata fails closed
and remains locked.

This is a technical authorization mechanism, not evidence that any private
EPUB has been inspected. Reading positions must be populated only from
verified structure. Narrative content remains outside this module and must be
authored as original, source-backed summaries when available.
