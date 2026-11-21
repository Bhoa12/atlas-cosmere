# Run 205 — first-safe-appearance completion boundary

## Finding

The trusted cross-world comparison presenter checked an entity's first-safe-
appearance chapter against `currentChapter`. For an in-progress cursor at
chapter N, that chapter is open but not completed: the canonical reading
projection reports `completedThroughChapter = N - 1`.

Using `currentChapter >= firstSafeChapter` therefore disclosed an entity
while the reader was still inside the chapter that establishes its first safe
appearance. This violated the same exclusive N-1 spoiler rule used by Atlas
and Community.

## Change

`subjectIsDisclosed()` now authorizes an in-progress entity only when:

`completedThroughChapter !== null && completedThroughChapter >= firstSafeChapter`

An explicitly completed work remains eligible. Missing progress, a missing
first-safe marker, and an incomplete first-safe chapter remain blocked.

## Regression coverage

The trusted comparison suite now verifies both sides of the boundary:

- If the first-safe chapter is currently open, the entire comparison is
  withheld before approved claims are loaded or presented.
- Once the reader advances to the next chapter, the previous first-safe
  chapter is completed and the entity may proceed to the remaining independent
  assignment, evidence, signature and progress checks.

The tests use synthetic entities, claims and evidence only. They do not assert
or add any Cosmere narrative fact.

## Security invariant

For an in-progress work at chapter N, the maximum completed chapter is N-1.
A first-safe appearance at chapter N is not disclosed until the reader advances
past N or explicitly completes the work.

This boundary is independent of evidence unlocks: both the entity disclosure
policy and the signed evidence presenter must authorize the result.

## Production status and privacy

This is a security correction to the comparison boundary. It does not populate
the editorial assignment registry, create reviewer approvals, provision trust
keys, or activate the comparison UI. No EPUB/XHTML body, extracted passage,
private source path or copyrighted narrative text is committed.
