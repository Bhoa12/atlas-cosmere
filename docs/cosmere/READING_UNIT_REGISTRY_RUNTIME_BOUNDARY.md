# Reading-unit registry runtime boundary

This registry provides a reusable technical representation for reading progress.

## What it guarantees

- canonical unit and work identifiers;
- unique unit identifiers;
- one-based, unique positions within each work;
- a stable minimal `work` unit that can represent progress before verified internal structure is available.

## What it does not claim

It does not infer chapters, pages, publication order, chronology, world membership, characters, events, or any protected source text.

Internal units may only be added from accessible, verified source metadata. Consumers should treat an invalid registry as unusable rather than attempting to repair it.

The registry is therefore suitable as an infrastructure boundary between the verified source catalogue and future progress/spoiler systems.
