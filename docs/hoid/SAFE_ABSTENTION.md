# Spoiler-neutral abstention

Abstention is part of Hoid IA's safety boundary, not merely an error state.

When the authorized context is insufficient, the user-facing explanation must not reveal:

- the existence of a future event;
- the chapter or reading position that caused a rejection;
- evidence identifiers or internal source names;
- the rejected assertion itself.

The `safeAbstention` contract therefore produces a small, immutable result with a
stable reason code for internal observability and a deliberately generic message for
the reader.

This preserves the fail-closed policy established by the evidence and provider
boundaries: a system may explain that it cannot answer safely, but it must never
turn the reason for abstaining into a spoiler.

The module contains no recovered EPUB text and does not treat catalogue metadata as
narrative evidence.
