# Cosmere expansion run 80

This increment adds small, pure navigation helpers around the existing expansion model.

## What it guarantees

- Worlds expose works only through explicit links; titles are never used to infer a world.
- Progress is reconciled only against known units belonging to the requested work.
- Completed units are returned in explicit reading order.
- Spoiler gates are fail-closed: empty or duplicate requirements, unknown units, or incomplete progress keep content locked.

## Provenance boundary

The verified `cosmere.epub` index remains a metadata catalog. Declared private EPUBs remain declared sources unless their relevant structure is actually accessible. This increment stores no protected passages and adds no editorial summaries or narrative claims.

The model is intentionally reusable for Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds.
