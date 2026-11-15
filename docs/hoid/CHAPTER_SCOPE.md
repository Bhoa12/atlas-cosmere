# Chapter scope boundary

`chapterScope.ts` is a provider-independent, pure authorization boundary for Hoid IA.

## Invariant

Narrative evidence is eligible only when all three identifiers agree:

1. the book explicitly requested by the reader;
2. the book recorded in the reader's progress;
3. the book attached to the candidate evidence.

The candidate chapter must also be a positive integer not greater than the reader's recorded last chapter.

## Failure policy

Unknown books, malformed chapter numbers, cross-book candidates and future chapters are denied. This module does not attempt to infer missing progress or repair ambiguous input.

## Copyright boundary

This component operates on identifiers and chapter metadata only. It stores no EPUB text and makes no claim that an inaccessible passage has been consulted.

## Integration

Call this boundary before retrieval results enter a provider prompt or an answer-verification stage. A provider must never be responsible for deciding whether a chapter is spoiler-safe.
