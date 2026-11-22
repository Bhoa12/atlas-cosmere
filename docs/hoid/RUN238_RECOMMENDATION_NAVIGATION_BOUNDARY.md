# Run 238 — Final validation boundary for recommendation navigation

## Purpose

Run 234 introduced edition-bound recommendation targets. Runs 235–237 made those
recommendations explainable, connected them to HoidScreen, and bound their
presentation identity to one canonical SQLite v2 snapshot.

A recommendation must not be treated as an executable navigation instruction
merely because it was valid when rendered. Progress or edition metadata can
change between rendering and a future reader action.

This run adds a final, provider-neutral handoff validator:
`prepareHoidRecommendationNavigationHandoff()`.

## Validation sequence

The function accepts an untrusted recommendation target, the latest
authoritative progress snapshot, and the exact progress revision/fingerprint
carried by the presentation that created the target.

It then:

1. Validates and canonicalizes the SQLite v2 snapshot.
2. Recomputes its SHA-256 identity and rejects stale revision/fingerprint pairs.
3. Copies the target from plain own data properties only; accessors, unexpected
   fields, proxies that fail descriptor inspection, and malformed records are
   rejected without invoking getters.
4. Validates the cursor against the current reading manifest.
5. Requires exact edition ID and navigation SHA-256 equality.
6. Resolves the cursor's unit from the current manifest.
7. Requires the exact opaque locator ID when a verified TOC locator exists;
   otherwise it accepts only the explicit `cursor-only` state with no locator.
8. Checks that the work is still in progress at exactly that cursor, or that an
   unstarted work is being opened at chapter 1. Completed works and stale
   cursors are rejected.
9. If several works are in progress, requires the exact explicitly selected
   active work. A target for a different active work is rejected; a chapter-one
   discovery target remains eligible after the reader has selected which active
   work to resume.

## Result contract

A `ready` result contains a frozen, metadata-only handoff with the canonical
cursor, manifest ID, edition ID, navigation digest and locator status.

An `unavailable` result is returned for:

- invalid progress or progress identity;
- stale revision/fingerprint;
- malformed or catalog-only target;
- edition/manifest mismatch;
- locator mismatch;
- completed work;
- a non-first chapter for an unstarted work;
- a cursor that differs from the current progress position.

## Important host limitation

The current Atlas host has no dedicated chapter-reader route. `App.tsx`
mounts the Atlas catalogue, tools, Hoid, quizzes, community and profile; the
existing book modal is a catalogue detail view, not an EPUB chapter reader.

HoidScreen now calls the validator against the live progress snapshot
before displaying an edition-cursor target as revalidated. This is a
display-time check only. For that reason this run deliberately does **not** add
a fake “open chapter” button, mutate the progress cursor, or route to the book
synopsis modal as a substitute for reading. A future reader host must call the
same boundary again immediately before resolving the opaque locator, and must
resolve it only inside the exact selected EPUB edition.

## Security and spoiler invariants

- Navigation validation does not grant narrative evidence.
- The current chapter cursor is not reinterpreted as a completed chapter.
- An unstarted work may target chapter 1 only.
- A completed work cannot be reopened through a recommendation handoff.
- A stale recommendation cannot be used after progress changes, even if a
  revision number is accidentally reused.
- TOC locator verification proves navigation structure only. It is not a
  chapter-body digest and is never accepted as narrative evidence.
- `cursor-only` remains a valid progress target but does not invent an EPUB
  path or URI.
- `catalog-only` recommendations cannot be handed to a chapter reader.
- No progress is written, no provider is called, and no EPUB/XHTML bytes,
  protected prose, private URI or new narrative summary is committed.

## Tests and CI

The dedicated Vitest suite covers exact current cursors, first-chapter discovery,
cursor-only targets, stale revision and fingerprint, cursor mismatch, completed
and unstarted work, catalog-only targets, edition and navigation-digest
substitution, locator substitution, accessor-backed objects, malformed
snapshots, and non-mutation.

The workflow also reruns the existing recommendation, explanation, progress
ledger and reading-manifest suites, followed by strict TypeScript checking.

## Source availability

No private EPUB was available in the current Library listing during this run.
No new chapter was inspected and no new narrative summary or source fingerprint
was added. The existing 24-work bibliography and source records remain
unchanged.
