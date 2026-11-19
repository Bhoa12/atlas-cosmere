# Run 166 — editorial regression fixture alignment

Run 165 added six individually inspected chapter documents and six original summary drafts. The source allowlist and editorial inventory therefore changed, while several older regression fixtures still asserted the Run 164 counts and used chapter nine as an example of an uninspected source.

## Corrections

- Update the sparse document inventory assertions to 10 documents for *The Way of Kings* and 11 each for *Edgedancer* and *Dawnshard*.
- Update the complete review-bundle packet count from 47 to 53, reflecting 35 summaries, one atomic claim, 14 entity dossiers and three relationship records.
- Update the fully resolved review subset from 45 to 51 packets. The unresolved identity remains excluded from that subset and remains a review blocker in the full bundle.
- Move the negative entity/alias source fixtures from *The Way of Kings* chapter 9 to chapter 11. Chapters 9 and 10 are now individually inspected; chapter 11 is still intentionally absent from the inspected-document allowlist. This preserves the security assertion rather than weakening it.

## Safety

These are regression-fixture and documentation changes only. No production entity, alias, claim, relationship, progress snapshot, approved registry or activation receipt is modified. The 35 chapter summaries remain pending independent review. No EPUB, XHTML or protected passage is added.

## Validation requirement

Run all applicable workflows on the Run 166 HEAD, including chapter-document coverage, review-bundle validation, editorial promotion, entity resolution, topic assignment, atomic claim validation, knowledge-kind contracts, source coverage, reading manifests and strict TypeScript. Keep the pull request in draft until the new HEAD is fully green.
