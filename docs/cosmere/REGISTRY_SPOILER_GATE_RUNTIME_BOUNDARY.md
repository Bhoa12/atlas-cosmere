# Registry-backed anti-spoiler boundary

`registrySpoilerGate.ts` composes the generic anti-spoiler gate with the
technical reading-unit registry.

Before content can become visible, every required unit ID must:

1. have canonical technical form;
2. exist in a registry that passes runtime validation;
3. be present in the reader's completed-unit IDs.

The boundary is fail-closed. A malformed registry, malformed content, duplicate
IDs handled by the underlying gate, or an unknown required unit prevents
visibility.

This layer does **not** determine what a unit represents editorially. It does
not inspect EPUB text, infer chapters or pages, assign worlds, establish
chronology, or make narrative claims. Payloads remain opaque to the boundary,
so supported summaries or future content can be supplied without teaching the
gate any Cosmere facts.
