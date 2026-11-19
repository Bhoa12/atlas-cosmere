# Run 165 — Metadata-only source ingestion plan

## Purpose

The source catalogue and offline EPUB inspection pipeline already distinguish edition metadata, navigation locators, inspected chapter bodies, editorial drafts and approved production knowledge. This module turns those records into a deterministic next-step queue so work can expand without guessing chapter paths or treating catalogue metadata as inspected narrative.

The plan is operational guidance only. It is not an evidence source, reading cursor, spoiler authorization or editorial approval.

## Current checked-in inventory

The plan is derived from the metadata-only coverage report and the exact edition-bound locator/document allowlists:

| Measure | Current value |
|---|---:|
| Catalogue works | 24 |
| Works with a safe next chapter-body inspection candidate | 20 |
| Continuations of already inspected works | 4 |
| New works ready to begin | 16 |
| Works blocked by unresolved segmentation | 4 |
| Individually inspected chapter documents | 29 |
| Original staged summaries | 29 |
| Summaries pending review | 29 |
| Approved production claims | 0 |
| Production knowledge entries | 0 |

These counts describe checked-in metadata. They do not assert that a private EPUB is currently selected or accessible.

## Deterministic priority

Tasks are ordered as follows:

1. Continue a work that already has individually inspected chapter documents, choosing the work with the smallest inspected count first.
2. Start other Cosmere works in canonical bibliography order.
3. Start other Roshar works in canonical bibliography order.

The current continuation candidates are:

| Work | Next chapter to inspect |
|---|---:|
| El Imperio Final | 4 |
| El Camino de los Reyes | 9 |
| Danzante del Filo | 10 |
| Esquirla del amanecer | 10 |

The other 16 candidates begin at chapter 1. Elantris and Viento y Verdad are eligible only within their already verified safe numeric prefixes (1–47 and 1–11 respectively). When those prefixes are fully inspected, the planner blocks further numeric work until the duplicate chapter locators are resolved.

Arena blanca vol. 1–3 remain blocked until each volume is segmented independently. Arcanum ilimitado remains blocked until its internal works/sections receive independent units.

## Candidate contract

Each task contains only:

- canonical work ID and title;
- source group and exact edition ID;
- chapter number;
- exact verified locator ID and its relative archive href;
- safe manifest coverage and counts;
- priority;
- an explicit local-source-selection requirement;
- the minimum reader chapter at which a future chapter-N summary could be unlocked (N+1).

The source-availability field is always not-checked. The planner does not receive a device URI, read archive bytes, inspect XHTML, or claim that the source file is present.

A consumer must still:
1. ask the reader to explicitly select the local EPUB;
2. bind that selection to the canonical work and registered edition;
3. run the candidate-only package inspection;
4. inspect only the exact navigation-backed XHTML target;
5. independently review the resulting digest and original summary before adding anything to editorial staging.

## Blocked and completed work

The planner reports unresolved volume segmentation, collection-section segmentation, missing/invalid locators, inconsistent coverage and ambiguous numbering as explicit blockers. It never fills gaps by synthesizing hrefs or guessing section boundaries.

A completed work means only that every numbered unit in its current manifest has an inspected document. It does not imply coverage of prologues, interludes, epilogues, appendices, illustrations or other unmodelled sections.

## Editorial and spoiler boundaries

- Existing staged summaries remain pending review.
- The plan does not expose summary prose, source passages, document hashes or private URIs.
- It does not approve claims or write to the production registry.
- A chapter-N inspection task sets its future minimum reader chapter to N+1; opening chapter N is not treated as completion.
- Each work retains its own reading boundary. A cursor in one book cannot authorize another book.
- EvidenceRuntime remains the only narrative authorization boundary.

## Implementation

- src/hoid/sourceIngestionPlan.ts builds the immutable, deterministic plan.
- src/hoid/sourceIngestionPlan.test.ts asserts task counts, priority, exact continuation chapters, partial safe prefixes, segmentation blockers, relative locator shape, next-chapter unlock and production isolation.
- hoid-source-ingestion-plan.yml runs the planner, source coverage, locator and manifest regressions with strict TypeScript checking.

## Scope of Run 165

This run adds a metadata-only planner and tests. It does not open a private EPUB, inspect a chapter body, generate a narrative summary, change progress, update the verified-document allowlist, approve a claim or write production knowledge. No EPUB, XHTML, extracted passage or private file URI is committed.
