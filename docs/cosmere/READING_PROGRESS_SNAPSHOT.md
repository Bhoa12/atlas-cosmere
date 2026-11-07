# Reading Progress Snapshot

`resolveReadingProgressSnapshot` converts already declared reading-unit progress into a small UI-safe snapshot.

It never creates editorial units or derives chapter structure. If the underlying unit structure or completed prefix is inconsistent, the result is `blocked` and exposes no next unit.

The snapshot is structural only: a `complete` status means every unit supplied to that call is complete, not that an entire edition or source file has been editorially verified.
