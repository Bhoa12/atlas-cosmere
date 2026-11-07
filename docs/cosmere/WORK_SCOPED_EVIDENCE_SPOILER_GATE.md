# Work-scoped evidence spoiler gate

`canRevealWorkScopedEvidenceContent` is a composition layer for spoiler-safe
content decisions.

It grants access only when all of the following are true:

1. the source is present in the declared private catalog;
2. the evidence identifier resolves to registered summary evidence for that
   exact source;
3. the requested content and progress belong to the same world;
4. they belong to the same work;
5. the requested position is inside the declared work range and is not ahead
   of validated completed progress.

The gate is intentionally fail-closed. It stores no passages, quotations,
chapter text, titles, or narrative facts. A declared source is not treated as
proof that its full text was inspected.

This contract is reusable for Scadrial, Sel, Nalthis, Taldain, Roshar and
future worlds because it uses only identifiers, provenance metadata and
structural reading positions.
