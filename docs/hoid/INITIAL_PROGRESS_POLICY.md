# Initial reading progress policy

Reading progress is an authorization input for Hoid. It must never be seeded
with illustrative or demo values.

## Fresh profiles

A new Atlas profile starts with empty chapter and completion maps. The helper
`createEmptyAtlasReadingProgress()` creates independent null-prototype maps.
No book is considered started or completed until the reader explicitly records
that state or a validated persisted profile is restored.

## Demo and fixture data

Demonstration progress must remain in UI-only fixtures and must not be passed
to `toHoidReadingPositions`, `HoidProgressLedger`, a spoiler guard, a claim
selector, or any provider adapter.

## Migration and restoration

Persisted progress is trusted only after schema, bibliography, edition and
snapshot validation. Missing, corrupt, ambiguous or unknown records fail
closed. A migration must not infer completion from a chapter number or infer
a chapter from a completion flag.

## Regression coverage

`initialProgress.test.ts` asserts that fresh profiles authorize no works,
that their maps do not inherit properties, and that profiles do not share
mutable progress state.
