# Hoid IA: retrieval boundary

## Repository contract

Knowledge repositories are provider-neutral and treated as untrusted boundaries.

- A repository response must be an array.
- Responses larger than `DEFAULT_MAX_HOID_RETRIEVAL_RESULTS` fail closed; Hoid IA does not truncate to an order-dependent prefix.
- Every item is canonicalized before authorization.
- Spoiler authorization is evaluated independently for each item's declared work and chapter.
- Duplicate knowledge identifiers are removed after authorization.
- The resulting context is capped at `DEFAULT_MAX_HOID_CONTEXT_ITEMS`.

This boundary intentionally operates on metadata and original editorial summaries rather than copying protected source passages.
