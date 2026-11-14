# Safe generation pipeline

`generateSafely` is the executable boundary between Hoid IA's spoiler policy and a concrete language-model provider.

## Order of operations

1. Evidence positions are checked against the immutable reading-progress snapshot.
2. If no evidence survives, the pipeline abstains and does not call the provider.
3. The provider receives only the surviving evidence identifiers.
4. Returned claims are checked again against exactly that identifier set.
5. Only verified claims are returned.

The pipeline does not load or copy private EPUB text. Evidence content must be prepared elsewhere from permitted, backed material. A catalog entry or reading position is not narrative evidence.

This provides defense in depth: the provider is constrained on input and cannot introduce a new evidence identifier on output. If an evidence adapter cannot supply backed material for an identifier, that identifier must not enter this pipeline.