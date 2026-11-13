# Response transparency and explanation boundary

This contract defines how Hoid IA explains an answer or recommendation without turning the explanation itself into a spoiler channel.

## Inputs

The explanation layer receives only identifiers already available to the request:

- authorized evidence identifiers for narrative claims;
- known work identifiers for reading-progress and catalog metadata claims;
- explicit preference identifiers for preference-based rationales.

It does not receive unrestricted source text, a free retrieval interface, or authority to infer missing narrative facts.

## Claim verification

Every visible explanation claim declares one or more bases. A claim is retained only when **all** of its bases are present in the request boundary.

This is intentionally fail-closed. A mixed rationale cannot keep its safe-looking wording while silently depending on an unavailable chapter or source.

## Outcomes

- `complete`: every proposed explanation claim was verified.
- `limited`: one or more unsupported claims were removed.
- `abstain`: no explanation claim was safe enough to display.

An abstention is preferable to inventing a reason for a recommendation.

## Spoiler property

Narrative explanation claims require identifiers from the same authorized-evidence budget used for the answer. Progress and catalog metadata may explain *why a work is eligible or relevant*, but they do not establish narrative facts about that work.

Consequently, changing providers cannot enlarge the explanation boundary: providers may propose claims, while this layer decides which claims are displayable.

## Copyright and private sources

This contract stores identifiers and original explanation text only. It does not copy passages from private EPUBs. If a passage is unavailable, no claim may represent it as consulted or use it as hidden support.

## Minimum tests

Future test suites should cover:

1. an authorized narrative claim surviving;
2. a claim citing an unknown evidence identifier being removed;
3. a mixed claim with one invalid basis being removed entirely;
4. recommendation explanations based only on declared preferences;
5. empty or unsupported input producing `abstain`;
6. mutation of the caller's claim objects not changing the returned basis snapshots.
