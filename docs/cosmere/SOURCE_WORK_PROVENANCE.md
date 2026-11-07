# Source-to-work provenance

A bibliographic source and a reading-model work are separate identifiers. Atlas
must not infer that a source can authorize narrative content for a work merely
because their titles look related.

`SourceWorkBinding` provides an explicit, editorial-neutral mapping:

- every source identifier is unique within a binding registry;
- every work identifier is unique within a binding registry;
- empty identifiers invalidate the registry;
- any malformed registry blocks all authorization checks.

The binding contains no passages, chapter text, summaries, titles, chronology,
world assignment or narrative facts. It is provenance metadata only.

The work-scoped evidence gate now requires four independent conditions:

1. a source is declared in the bibliographic catalog;
2. a registered evidence record is a valid original-summary record for that source;
3. the source is explicitly bound to the requested work;
4. the requested position is inside the validated work-scoped reading frontier.

This keeps authorization fail-closed and prevents a valid source-level summary
record from being reused for an unrelated work.