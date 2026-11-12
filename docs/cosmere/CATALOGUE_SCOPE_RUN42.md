# Catalogue scope boundary

This module is a reusable technical boundary for the Atlas expansion.

## Data flow

`source provenance -> worlds and works -> explicit world/work links -> reading units -> progress -> reveal gate`

## Editorial safety

- A title is metadata, not evidence of a world assignment.
- World/work links must be explicit and reference a known source record.
- `declared-private` means a private source exists; it does **not** claim that its internal passages were inspected.
- Reading units are structural metadata. This module does not invent chapter boundaries.
- The reveal gate is deliberately fail-closed and does not decide what is a spoiler.

The module contains no EPUB text, quotations, or copied editorial prose. Tests use synthetic records only.

## Priority worlds

The architecture can represent Scadrial, Sel, Nalthis, Taldain, Roshar, and additional worlds through ordinary `WorldRecord` entries. Their relationships to works must be supplied as verified metadata rather than inferred by this layer.
