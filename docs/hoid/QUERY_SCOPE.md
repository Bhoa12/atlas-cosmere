# Query scope

Hoid IA must resolve the reader's progress **before** retrieving narrative context or calling a provider.

`resolveQueryScope` is intentionally conservative:

- an empty question is rejected;
- an invalid requested chapter is rejected;
- a work without explicit reader progress is rejected;
- a chapter beyond recorded progress is rejected;
- if no work is requested, the result carries no implicit narrative authorization.

The returned scope is metadata only. It does not read EPUB text and does not treat catalogue membership as evidence.

Downstream retrieval must intersect this scope with provenance-backed evidence. A successful scope therefore means only that the request is well bounded; it never proves that a narrative claim is available or supported.

This keeps request interpretation separate from providers and from source access. Providers should receive only the already-authorized scope and evidence, never private EPUB files or unrestricted catalogue access.
