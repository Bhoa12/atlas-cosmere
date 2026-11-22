# Run 234 — Edition-bound recommendation targets

## Objective

Convert metadata-only reading recommendations into safe navigation targets bound to the reader's authoritative cursor-native v2 snapshot and the exact edition manifest. A chapter number must never become a guessed EPUB path or a cursor that silently crosses editions.

## Contract

`recommendEditionBoundReadingNextSteps()` accepts the complete v2 cursor snapshot and validates it with `validateHoidCursorProgressSnapshot()` before producing any item.

A resume recommendation uses the chapter currently open in the cursor. Its completed-through watermark is exactly `chapterNumber - 1`; chapter one therefore has no completed-through chapter. If multiple works are in progress and no active work is specified, the function does not guess.

Each recommendation has one of two navigation target forms:

- `edition-cursor`: an exact `HoidReadingCursor`, manifest-derived edition ID, navigation digest, and an optional verified opaque locator.
- `catalog-only`: the work remains discoverable by title, but unresolved segmentation or a missing manifest unit prevents a chapter target.

The cursor is checked against the same manifest before it is returned. When an opaque locator is unavailable, the result explicitly reports `cursor-only`; it does not invent a locator or URL.

## Safety invariants

- The authoritative input is a validated cursor-native v2 snapshot, not a caller-projected legacy progress array.
- The current work is resumed only when it is the sole in-progress work or the caller explicitly identifies it.
- The current chapter is taken from the validated cursor, not inferred by incrementing an untrusted number.
- The cursor's manifest ID, unit ID, ordinal and chapter number must match the manifest unit.
- Unsegmented works remain catalog-only.
- A completed work is never reopened by recommendation.
- No cross-book reading order, canon dependency or plot relationship is inferred.
- Recommendations contain metadata only; they do not authorize narrative evidence or change reader progress.
- Invalid snapshots, unknown active-work IDs and non-finite limits fail closed.

## Scope and limitations

This is a navigation contract, not a reading-order engine. It does not decide whether one Cosmere work should be read before another, does not infer inter-book chronology, and does not create narrative summaries. The cursor remains a numbered-chapter-only unit; prologues, interludes, epilogues and other special sections are outside this manifest contract.

No EPUB bytes, XHTML, chapter text, private file URI, reading progress or production knowledge are added or changed.
