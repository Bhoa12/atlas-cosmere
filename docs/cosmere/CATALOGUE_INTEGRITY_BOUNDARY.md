# Catalogue integrity boundary

This module validates catalogue metadata before it is connected to worlds, reading units, progress, or spoiler gates.

## Provenance

A `verified-index` source may support the metadata explicitly verified in its index. A `declared-private` source records that a private source exists, but does **not** mean its passages or internal structure were inspected.

## Guarantees

The validator rejects malformed or duplicate identifiers, empty titles, and references to unknown sources. It does not infer world membership, chronology, chapters, plot facts, or reading order.

This keeps the expansion pipeline conservative:

`source provenance → catalogue metadata → explicit world/work relations → verified reading units → progress → spoiler access`.

No protected text is stored or copied by this layer.
