# Run 203 — Revalidate topic assignments at presentation

## Problem

The Run 202 trusted presenter re-authenticated every referenced claim and
compared its signed text and citations with the candidate recommendation.
However, its public input still accepted the candidate's target work, topic,
dimension and claim tuple from the caller. Canonical taxonomy labels and a
valid signed claim do not, by themselves, prove that the reviewed registry
actually assigns that claim to that target work.

The local recommendation gateway normally builds candidates from the
production assignment registry, but the final presentation boundary must not
treat gateway output as authority.

## Change

The trusted presenter now re-resolves the production topic-assignment
activation result on every presentation. Production uses
`resolveProductionHoidTopicAssignments()`, which returns `active` only when
the checked-in assignment registry and its activation receipt validate.

Every candidate match is then rebound to exactly one active assignment with
the same:

- target work (`subjectKind = work`, `subjectId = sourceId`);
- topic and dimension;
- approved claim ID;
- SHA-256 digest of the exact claim text;
- sorted evidence-ID set matching the signed citations.

Unknown, inactive, invalid, duplicated, malformed or unavailable assignment
state withholds the entire recommendation batch before approved claims are
loaded.

## Architecture

- `trustedTopicAssignmentGuard.ts` is a pure, provider-neutral boundary.
- `trustedTopicRecommendations.ts` calls the production resolver at the final
  presentation boundary; a test/composition seam can be injected only by the
  trusted host.
- The existing Ed25519 presenter still authenticates each claim and the
  current SQLite progress is still refreshed before and after verification.
- The gateway remains a candidate selector, not an authorization authority.

## Tests

The new guard tests cover exact tuple matching, target-work substitution,
claim digest mismatch, evidence-set mismatch, duplicate assignments,
invalid dimensions, unsorted evidence and accessor rejection. Presenter
regressions verify that inactive or mismatched assignments are rejected before
the approved-claim loader is called.

## Production state

The production topic assignment registry and activation receipt remain empty.
Consequently the production resolver remains inactive and no thematic
recommendations are enabled. Test fixtures are synthetic and do not add
Cosmere facts or promote editorial knowledge.

No EPUB/XHTML body, extracted passage, private source path or copyrighted
narrative text is committed.
