# Registry-backed anti-spoiler boundary

`registrySpoilerGate.ts` composes the generic anti-spoiler gate with the technical reading-unit registry.

Before content can become visible, both required and completed unit IDs must have canonical technical form and exist in a registry that passes runtime validation. Completed IDs must also be unique.

The boundary is fail-closed: malformed registries, malformed content, malformed or duplicate completed IDs, and unknown units prevent visibility. Progress input is never silently filtered or deduplicated.

This layer does **not** determine editorial structure. It does not inspect EPUB text, infer chapters or pages, assign worlds, establish chronology, or make narrative claims. Payloads remain opaque to the boundary.
