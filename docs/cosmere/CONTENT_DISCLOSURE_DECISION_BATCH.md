# Content Disclosure Decision Batch

`resolveContentDisclosureDecisionBatch` provides a presentation-safe batch adapter for Atlas del Cosmere.

Before producing any decision, it requires a strict one-to-one correspondence between declared evidence records and anti-spoiler requests by `contentId`.

- A valid batch returns decisions in evidence order.
- Duplicate, missing, or unmatched identifiers block the whole batch.
- A blocked batch returns no partial decisions.

The adapter only combines existing technical decisions. It contains no narrative text, source excerpts, inferred editorial facts, or hidden spoiler descriptions. It does not upgrade evidence or reading progress.

This makes the same disclosure workflow reusable for Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds while keeping provenance and anti-spoiler policy fail-closed.
