# Hoid IA — Knowledge Boundary

This contract introduces an explicit capability boundary between evidence
authorization and any provider, formatter, explanation, or recommendation layer.

## Purpose

An evidence identifier is a capability, not a hint. A component may only use an
identifier present in the immutable boundary created for the current request.

The boundary deliberately contains identifiers and structural positions only. It
does not contain EPUB text and does not imply that a catalogue entry is
narrative evidence.

## Invariants

1. Evidence identifiers and work identifiers must be non-empty.
2. Chapters must be positive integers.
3. Duplicate identifiers do not create additional authority.
4. A provider cannot mint an identifier by returning a new string.
5. Output references are intersected with the request boundary.
6. The boundary is a snapshot: later progress changes require a new request
   boundary.

## Integration

The intended flow is:

`reader progress → context budget → authorized evidence → knowledge boundary → provider → output verification`

Explanation and recommendation layers must use the same boundary whenever they
make narrative claims. If verification leaves no supported narrative basis, the
caller must limit the response or abstain according to the response policy.

## Source catalogue

The private Cosmere and Roshar EPUB bibliography may supply work metadata and
reading structure. It must not be treated as accessible narrative evidence
unless the relevant passage is actually available to the retrieval layer.
