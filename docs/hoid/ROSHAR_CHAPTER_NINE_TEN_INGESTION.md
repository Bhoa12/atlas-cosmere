# Run 165 — Roshar chapter-nine and chapter-ten inspection

## Source assets

Three unique EPUBs were selected from the current Library listing. Duplicate copies with the same size and content were not materialized.

| Work | Library asset | Edition ID | Navigation document | Navigation SHA-256 |
|---|---|---|---|---|
| El Camino de los Reyes | El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub | roshar-omnibus-v1 | OEBPS/Text/nav.xhtml | 08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025 |
| Danzante del Filo | 4 Danzante del Filo Brandon Sanderson.epub | edgedancer-epub-v1 | OEBPS/toc.ncx | 5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517 |
| Esquirla del amanecer | 6 Esquirla del amanecer Brandon Sanderson.epub | dawnshard-epub-v1 | OEBPS/toc.ncx | 8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075 |

The three navigation digests match the edition-bound values already present in the repository.

## Exact chapter targets

Each target was resolved from the EPUB navigation document, confirmed in the package OPF manifest as XHTML, confirmed in the reading spine, and then hashed from its original archive bytes.

| Work | Chapter | TOC label | Relative XHTML target | Bytes | Document SHA-256 | Earliest reader chapter |
|---|---:|---|---|---:|---|---:|
| El Camino de los Reyes | 9 | 9. Condenación | OEBPS/Text/L1-023.xhtml | 16,937 | c5737b3dc6b37d9bd9166d910f70c2f39f522ceb07123703387b34399e703945 | 10 |
| Danzante del Filo | 10 | Capítulo 10 | OEBPS/Text/010.xhtml | 14,883 | 4fe0dc1e86f52d76bcabef23c4b730ba15543db5491559eed44462b4dfbfe6bf | 11 |
| Esquirla del amanecer | 10 | Capítulo 10 | OEBPS/Text/10.xhtml | 20,417 | 0f5c780ddda44ce97eb36d944182c2ffe80fb86867a00e60fc4143377dd9dd22 | 11 |

No chapter text, XHTML body or extracted passage is stored in this document or the repository.

## Original summaries staged

| Draft ID | Chapter scope | Unlock | Review status |
|---|---:|---:|---|
| twok.chapter-009.kaladin-recruit-death | El Camino de los Reyes 9 | 10 | pending-review |
| edgedancer.chapter-010.lift-orphanage-reflection | Danzante del Filo 10 | 11 | pending-review |
| dawnshard.chapter-010.rysn-arrests-nikli | Esquirla del amanecer 10 | 11 | pending-review |

The summaries are original Spanish editorial prose. They are bound to the exact edition ID, navigation digest, chapter locator, document digest and summary digest in the staging records.

No new character dossier, relationship or atomic claim was created from these chapters. The chapter-ten summaries do not unlock while chapter ten is open; the cursor must reach chapter eleven. Each work retains its own independent reading boundary.

## Coverage after Run 165

- El Camino de los Reyes: chapters 1–9 individually inspected and staged.
- Danzante del Filo: chapters 1–10 individually inspected and staged.
- Esquirla del amanecer: chapters 1–10 individually inspected and staged.
- El Imperio Final: chapters 1–3 remain the only individually inspected Cosmere chapters.
- Total individually inspected chapter documents: 32 across four works.
- Total original staged summaries: 32; all remain pending review.
- Approved claims: 0.
- Production knowledge entries: 0.

The current Library listing did not include cosmere.epub. No new Cosmere chapter was inspected or inferred from its catalogue metadata.

## Integrity and copyright boundary

The repository contains only original summaries, edition metadata, relative navigation locators, SHA-256 digests and review status. It does not contain EPUB bytes, XHTML, copied paragraphs, extracted passages, images or private file URIs. The local materialized copies were used read-only and are not part of the Git branch.
