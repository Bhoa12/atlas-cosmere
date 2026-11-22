# Run 234 — Edition-bound recommendation targets

## Objective

Convert the existing metadata-only recommendation list into safe navigation targets that are bound to the exact edition manifest. The recommendation layer must not turn a chapter number into a guessed EPUB path or silently carry a cursor across editions.

## Contract

`recommendEditionBoundReadingNextSteps()` first validates edition-bound reading positions, then delegates prioritization to the existing deterministic recommendation policy.

Each recommendation has one of two target forms:

- `edition-cursor`: an exact `HoidReadingCursor`, manifest-derived edition ID, navigation digest, and an optional verified opaque locator.
- `catalog-only`: the work remains discoverable by title, but unresolved segmentation or a missing manifest unit prevents a chapter navigation target.

The cursor is checked against the same manifest before it is returned. When an opaque locator is unavailable, the result explicitly reports `cursor-only`; it does not invent a locator or URL.

## Safety invariants

- The current work is resumed only when it is the sole in-progress work or the caller explicitly identifies it.
- The next chapter must exist in the current numbered-chapter manifest.
- The cursor's manifest ID, unit ID, ordinal and chapter number must match the manifest unit.
- Unsegmented works remain catalog-only.
- A completed work is never reopened by recommendation.
- No cross-book reading order, canon dependency or plot relationship is inferred.
- Recommendations contain metadata only; they do not authorize narrative evidence or change reader progress.
- Invalid progress, unknown active work and non-finite limits fail closed.

## Scope and limitations

This is a navigation contract, not a reading-order engine. It does not decide whether one Cosmere work should be read before another, does not infer inter-book chronology, and does not create narrative summaries. The cursor remains a numbered-chapter-only unit; prologues, interludes, epilogues and other special sections are outside this manifest contract.

No EPUB bytes, XHTML, chapter text, private file URI, reading progress or production knowledge are added or changed.
