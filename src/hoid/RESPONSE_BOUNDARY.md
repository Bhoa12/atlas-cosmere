# Response Boundary Contract

## Purpose

The final Hoid IA response boundary accepts untrusted provider output and returns only evidence-bound claims whose identifiers are already authorized for the current request.

This contract is provider-neutral. A provider may choose wording, but it cannot grant itself narrative authority, enlarge the reader's progress, or introduce evidence identifiers that were not supplied by the local authorization layer.

## Input invariants

- The payload must contain an array of claims.
- At most `DEFAULT_MAX_PROVIDER_CLAIMS` raw claims are accepted; an oversized array fails closed as a whole.
- Every accepted claim has valid bounded provider text.
- Every accepted claim has at least one evidence identifier.
- Every evidence identifier must be authorized for the current request.
- Invalid, mixed-authority, malformed, or unsupported claims are discarded.

## Canonical output

Evidence identifiers are copied, deduplicated, and sorted before crossing the boundary.

Claims are deduplicated by the pair of:

1. validated claim text;
2. canonical evidence identifier set.

Therefore provider ordering and repeated evidence identifiers do not change the public meaning of an accepted claim.

The boundary does not mutate provider-owned arrays or objects.

## Free-form prose

The top-level `answer` field is deliberately emitted as an empty string.

Without claim-level evidence, free-form prose cannot be mechanically distinguished from unsupported assertions, indirect spoilers, or provider hallucinations. Applications that need conversational prose must derive it from already accepted claims in a separate local presentation layer; they must not reintroduce raw provider prose after this boundary.

## Security properties

The boundary is fail-closed for oversized payloads and unknown evidence. It is deterministic for semantically equivalent evidence orderings and isolates untrusted provider data from internal mutable state.

It is not a substitute for upstream authorization: evidence identifiers prove only that a claim references locally authorized knowledge. Progress validation, book/chapter authorization, retrieval scope, and spoiler policies remain independent earlier layers.

## Required regression cases

Any change to this boundary should preserve tests for:

- unknown evidence;
- mixed authorized and unauthorized evidence;
- missing or malformed claims;
- oversized claim arrays;
- duplicate claims with reordered evidence;
- repeated evidence identifiers;
- canonical evidence ordering;
- preservation of provider-owned input arrays;
- rejection of top-level free-form prose.
