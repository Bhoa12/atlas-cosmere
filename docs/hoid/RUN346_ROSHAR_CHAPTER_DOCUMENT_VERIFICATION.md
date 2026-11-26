# Hoid Run 346 — Roshar chapter-document verification

## Source files inspected

The Library contains the five-book Roshar omnibus and separate EPUBs for Danzante del Filo and Esquirla del amanecer. The selected original files were:
- El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub (97,318,466 bytes)
- 4 Danzante del Filo Brandon Sanderson.epub (2,176,643 bytes)
- 6 Esquirla del amanecer Brandon Sanderson.epub (2,062,124 bytes)

The omnibus OPF title identifies five novels. Its EPUB 3 navigation document SHA-256 is
08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025, exactly matching the registered
roshar-omnibus-v1 edition. The separate novella NCX digests also match the existing
edgedancer-epub-v1 and dawnshard-epub-v1 edition records.

## Chapter document fingerprints added

Using the already registered navigation locators and the exact XHTML members in the matching EPUB:
- Palabras radiantes (wor): chapters 1–10
- Juramentada (ob): chapters 1–10
- El Ritmo de la Guerra (row): chapters 1–10
- Viento y verdad (sawt): chapters 1–11 only

The existing verified chapter digests for El Camino de los Reyes were compared against the same EPUB; all 23 previously registered digests matched. No additional El Camino hashes were added in this change.

The added values are SHA-256 fingerprints of original chapter XHTML bytes. They are metadata-only integrity records; no XHTML, chapter text, summaries, titles, passages, or local paths are committed.

## Spoiler and ambiguity policy

Viento y verdad has duplicate chapter labels 12 and 14 in this edition. Numeric chapter-body fingerprints stop at chapter 11. The duplicate locators remain separate and are not treated as a unique numeric chapter. No chapter 12 or later is unlocked by this addition.

## Coverage impact

The metadata-only source coverage report increases from 4 works / 73 inspected chapter documents to 8 works / 114 inspected chapter documents. This is byte-integrity coverage, not editorial approval or narrative review. All staged summaries remain pending review and the production knowledge graph remains empty.

## Missing source group

No cosmere.epub file was found in the Library listing. The 17-work Cosmere catalogue remains metadata-only; no new Cosmere chapter digests or narrative claims are added here.
