# Run 295 — Cursor-backed exact-unit progress bridge

## Purpose

The Atlas application currently writes reader progress through
\`HoidCursorProgressCoordinator\` and the durable SQLite v2 cursor ledger.
The trusted exact-unit conversation host consumes
\`HoidUnitProgressCoordinator\` and a v3 unit-cursor snapshot.

Creating a second independent ledger for the trusted host would allow the
reader and spoiler gate to disagree. This run adds a read-only projection so
both components observe the same durable reader state.

## Data flow

1. Atlas commits progress to the existing cursor SQLite ledger.
2. The adapter loads and validates the complete v2 snapshot.
3. Each partial cursor is resolved again against the current edition manifest.
4. The chapter number, unit ID, ordinal and manifest identity must all match.
5. The adapter constructs the v3 exact-unit cursor using the verified chapter
   reference, including its edition-bound identity fingerprint.
6. Explicit work completion is preserved as an explicit completion record.
7. The v2 revision and timestamp are retained for freshness checks.
8. The resulting snapshot is validated again by the v3 ledger validator.

No cursor is inferred from a chapter label alone. If any partial position
cannot be represented exactly, the complete projection is unavailable; the
adapter does not silently drop progress.

## Write authority

The adapter is intentionally read-only. Its compare-and-swap operation always
returns false and never delegates to the source cursor store. All reader
mutations continue through the existing Atlas cursor coordinator. This avoids
two independent writers and preserves the current SQLite migration and CAS
rules.

## Invalidation

The runtime exposes a payload-free invalidation port backed by the same cursor
coordinator used by Atlas. The host can subscribe to committed reader changes
and retract visible answers. The exact-unit coordinator also refreshes the
durable store before freshness-sensitive operations, so notifications are not
treated as authorization data.

## Scope and limitations

- This is a progress-authority bridge, not a trust bootstrap.
- It does not provision a root key, reviewer registry, anti-rollback checkpoint
  or signed editorial packages.
- It does not connect the composition to \`App.tsx\` or enable narrative output.
- It does not add a second SQLite table or change the v2 reader schema.
- It does not alter the catalogue or infer chapter-body content from TOC links.
- Works whose chapter structure is not verified remain unavailable under the
  existing manifest policy.

The bridge contains no EPUB text, chapter titles, extracted passages or
private keys. Its tests use synthetic progress snapshots.
