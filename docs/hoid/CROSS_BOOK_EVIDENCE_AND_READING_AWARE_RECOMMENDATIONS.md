# Run 131 — cross-book evidence and reading-aware recommendations

## Cross-book evidence composition

The new `crossBookEvidence.ts` helper derives a compact work matrix only after calling `presentHoidEvidenceAnswer()` with the live v2 progress snapshot. This reuses the existing final presentation boundary rather than creating a second source of spoiler authority.

The summary contains:

- one work group per bibliography identity;
- exact catalogue title;
- sorted, unique source chapters;
- evidence IDs belonging to that work;
- the source-work IDs used by each claim segment.

A cross-book summary is emitted only when at least two distinct works support the authorized answer. Single-work answers remain ordinary answers. Legacy answers without segment-level provenance do not receive a cross-book matrix.

Each source retains its own work-local unlock rule. A cursor in one work never unlocks a citation in another. If any source is locked, malformed or inconsistent with its segment mapping, the entire summary is withheld. The existing per-segment citations remain the primary claim-level provenance.

The UI displays the cross-book coverage summary above the individual segments. It does not generate connective prose or new narrative claims.

## Reading-aware recommendations

The recommendation pipeline now distinguishes:

1. `resume-current-work`: a work already in progress, with the exact open chapter and the last completed chapter (null when chapter one is open);
2. `unread-source`: a bibliography work not present in the started-work set.

Active works are prioritized before unstarted catalogue entries. Explicitly completed works are not suggested for resumption. The recommendation helper validates exact catalogue IDs/titles, unique works, current/completed chapter consistency, canonical progress context and bounded output.

The conversation gateway independently revalidates resume metadata against the v2 cursor context and rejects forged or stale chapter values. It also rejects unread entries for any started work. Before/after progress revision and fingerprint checks remain unchanged.

This is not a canonical reading-order recommender. It does not infer plot chronology, series dependencies, thematic similarity or spoiler-safe sequencing. The current bibliography exposes only source identity and source group; no narrative tags or approved cross-work dependency records are available. Unstarted entries therefore remain in catalogue order and are labelled as discovery, not as a recommended sequence.

## Source and privacy boundary

No EPUB, XHTML body, extracted passage or protected narrative text is read or committed in this run. The cross-book matrix uses only already validated citation metadata. Recommendation logic uses only the private-source bibliography and the validated reader progress snapshot. No knowledge is promoted and no progress is modified.

## Verification

Focused tests cover:
- two-work source grouping and per-segment mapping;
- independent unlock requirements for each work;
- single-work and legacy-answer behavior;
- multiple chapters from one work;
- resuming chapter one without manufacturing a completed chapter;
- active-work prioritization and explicit completion;
- unknown, duplicate, title-mismatched and already-started recommendation candidates;
- forged current chapter and completed-through boundaries;
- progress freshness at the conversation gateway.
