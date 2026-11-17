# Cursor-Native Reading Context

## Purpose

`buildHoidCursorReadingContext()` creates a user-facing, metadata-only projection of the authoritative SQLite v2 progress snapshot. It is used for questions about the reader's position, not for narrative recaps.

## Validation

The builder:
- validates the complete v2 snapshot and rejects duplicate or unknown works;
- resolves every cursor against its exact edition manifest;
- uses the same `projectHoidCursorPositionToBoundary()` function as spoiler authorization;
- obtains titles only from the validated source bibliography;
- returns no chapter prose, chapter titles, plot facts or inferred reading order.

## Chapter semantics

For an in-progress cursor at chapter N:
- `currentChapter` is N;
- `completedThroughChapter` is N-1;
- chapter one has `completedThroughChapter: null`.

An explicitly completed work is represented as `completedThrough: "entire-work"`; no final chapter number is manufactured.

## Gateway freshness

`HoidConversationGateway.readingContext()` validates the request snapshot against the live coordinator snapshot before projection and rechecks it after projection. A stale or invalid snapshot returns no context payload.

## Coverage and counts

The context distinguishes works with a verified numbered-chapter manifest from works whose segmentation is not yet verified. It does not label every absent cursor as “unread”: some catalogue works may not yet have a trackable reading structure. Counts therefore separate started positions, trackable-but-unstarted works and untracked works.

## Coverage

The context reports only verified numbered-chapter units. Special sections, ambiguous chapter numbers, graphic-novel volumes and story-level structures remain unavailable until their manifests are independently verified. The output is not a plot summary and must not be sent to a provider as narrative evidence.
