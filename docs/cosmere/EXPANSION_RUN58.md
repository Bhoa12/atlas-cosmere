# Cosmere expansion run 58

This module provides a reusable, source-safe data model for expanding Atlas del Cosmere without treating private EPUB text as a public content source.

## Data flow

`SourceRecord -> WorkRecord -> ReadingUnit -> ReadingProgress -> SpoilerGate`

Worlds are a separate navigation layer. A work may reference a world only when that relationship is supplied as explicit metadata; titles and file names are not evidence for an automatic assignment.

## Bibliography policy

The verified index supplied for `cosmere.epub` may be represented as title metadata, including:

- El Imperio Final
- El Pozo de la Ascensión
- El Héroe de las Eras
- Aleación de ley
- Sombras de identidad
- Brazales de Duelo
- El metal perdido
- El aliento de los dioses
- Elantris
- Arena blanca, volúmenes 1 a 3
- Trenza del mar Esmeralda
- Yumi y el pintor de pesadillas
- El Hombre Iluminado
- Islas de la ascuaoscura
- Arcanum ilimitado

Private Roshar EPUBs are tracked only as declared sources unless their accessible metadata is separately verified. This run does not claim to inspect passages, chapters, or other internal text.

## Spoiler policy

`canReveal` is fail-closed: absent progress, empty requirements, duplicate requirements, missing units, cross-work units, or incomplete progress all keep content hidden.

## Copyright boundary

No EPUB text is stored in this module. Future summaries must be original, concise, and supported by accessible information. If a passage is unavailable, the application must not invent facts or claim that the passage was consulted.
