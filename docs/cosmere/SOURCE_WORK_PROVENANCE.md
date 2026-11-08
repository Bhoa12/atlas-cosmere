# Source-to-work provenance

A bibliographic source and a reading-model work are separate identifiers. Atlas
must not infer that a source can authorize narrative content for a work merely
because their titles look related.

`SourceWorkBinding` provides an explicit, editorial-neutral mapping:

- every source identifier is unique within a binding registry;
- several independently cataloged sources may explicitly bind to the same work;
- empty identifiers invalidate the registry;
- any malformed registry blocks all authorization checks.

The many-to-one rule supports reusable source catalogs without forcing an
artificial one-source-per-work model. It does not infer relationships: every
source-to-work association still has to be registered explicitly.

The binding contains no passages, chapter text, summaries, titles, chronology,
world assignment or narrative facts. It is provenance metadata only.

The work-scoped evidence gate requires independent conditions:

1. a source is declared in the bibliographic catalog;
2. a registered evidence record is a valid original-summary record for that source;
3. the source is explicitly bound to the requested work;
4. the requested position is inside the validated work-scoped reading frontier.

This keeps authorization fail-closed and prevents a valid source-level summary
record from being reused for an unrelated work.
