# Spoiler disclosure manifest

`resolveSpoilerDisclosureManifest` is the final metadata-only handoff between
explicit spoiler access decisions and presentation.

## Contract

Every declared content item must have exactly one access decision, and every
access decision must correspond to exactly one declared item. Any duplicate,
missing, empty, or orphan identifier blocks the entire result.

The output contains only:

- a content identifier;
- a caller-supplied classification (`kind`);
- a visibility boolean.

It deliberately does not contain narrative text, EPUB excerpts, summaries, or
editorial facts. Protected payloads must be fetched or rendered only after a
separate presentation layer consumes a valid manifest entry.

## Safety boundary

The manifest does not establish that a work was read, that a fact was verified,
or that content is editorially safe. It only preserves an already computed
authorization decision and fails closed when the identifier graph is incomplete.
This keeps bibliography, reading progress, checkpoint evaluation, access policy,
and narrative evidence as separate concerns.
