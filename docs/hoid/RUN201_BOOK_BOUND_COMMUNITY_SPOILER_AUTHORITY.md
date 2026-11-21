# Run 201 — book-bound community spoiler authority

## Finding

Run 200 corrected the meaning of the Atlas chapter projection: the UI stores
the chapter currently open (N), while narrative authorization uses the
completed-through boundary (N-1). The Community screen still reconstructed
its decision from two independent maps: a numeric chapter map and a separate
whole-book completion map.

That left the screen responsible for keeping two values synchronized and
made it possible for stale React state to remain visible if the progress
coordinator became unavailable. The context previously cleared the v2
snapshot and marked persistence unavailable, but retained its old display
maps. Community could therefore continue evaluating comments against a
previously advanced cursor.

## Changes

- Add a canonical, book-bound HoidReaderBoundary input for Community spoiler
  authorization.
- Add isCommunityPostBeyondReadingBoundary(bookId, chapter, boundary).
- Reject missing, malformed, mismatched, accessor-bearing and unknown-key
  boundaries; invalid comment metadata fails closed.
- Derive Community boundaries, Atlas display chapters and explicit completion
  from the same validated v2 cursor snapshot.
- Store all Atlas progress projections in one React state object so they are
  replaced atomically.
- Clear all progress projections when snapshot validation, initialization or
  refresh becomes unavailable. An unavailable ledger now means Community
  shields all posts rather than reusing stale progress.
- Migrate CommunityScreen away from separately combining numeric chapter and
  completion maps.
- Extend the cursor-native workflow to type-check CommunityScreen and run the
  reading-boundary regression suite.

## Spoiler invariants

- For an in-progress cursor at chapter N, only posts ending at or before N-1
  are eligible.
- Chapter one has a valid in-progress boundary with no completed chapters.
- Whole-work visibility requires an explicit completed state from the
  validated ledger; a cursor at the final numbered chapter is not equivalent.
- A boundary for one work cannot authorize a post from another work.
- Missing or unavailable progress is fail-closed.
- The manual reveal action remains an explicit user choice and does not alter
  the underlying authorization boundary.

## Scope and source policy

This run changes progress projection and community authorization only. It
does not inspect EPUB content, change chapter locators, summaries, claims,
editorial approvals, production knowledge or personal reading progress. No
EPUB, XHTML, extracted prose, image or private source path is committed.

## Validation

The updated hoid-cursor-native-atlas workflow must pass on the final HEAD.
It now runs cursorAtlasAdapter.test.ts and readingBoundary.test.ts, and
strictly type-checks CosmereContext.tsx, CommunityScreen.tsx and
HoidScreen.tsx. Keep the PR in draft until that workflow and all relevant
checks succeed on the final HEAD.

## Isolation

- Base: feat/hoid-ia-core-run200
- Exact base SHA: 7500c93332c4d2d9bd8af459b20caea9a1871769
- Head: feat/hoid-ia-core-run201
- No changes to main, PR #93, Run 200 or earlier branches.
- No merge or production promotion.
