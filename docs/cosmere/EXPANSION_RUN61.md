# Cosmere expansion run61

This iteration defines a small, reusable domain layer for sources, worlds, works, reading units, reading progress, and spoiler gates.

## Provenance boundary

The seed records only metadata from the verified `cosmere.epub` index supplied by the user. Roshar private EPUBs remain a declared source collection unless their internal structure is explicitly accessible in the environment.

No protected text, chapter text, quotations, or invented editorial facts are stored here. Titles do not automatically imply world membership, chapter structure, or narrative relationships.

## Anti-spoiler policy

`canReveal` is fail-closed. A gate is visible only when every explicit, unique requirement exists, belongs to the same work, and is completed by progress for that work. Unknown, foreign, and duplicate progress entries are normalized away before evaluation.

## Extensibility

World records are independent navigation metadata. Work-to-world relationships remain optional and must be supplied explicitly by supported metadata. This keeps Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds on the same schema without inference.