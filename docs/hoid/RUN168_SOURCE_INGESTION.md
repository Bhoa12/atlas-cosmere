# Run 168 — source-backed chapter ingestion

## Scope

This run inspected four chapter bodies from the private EPUBs in the Library. Only original editorial summaries, edition-bound navigation locators, SHA-256 digests and review metadata were committed. EPUB archives, XHTML bodies, extracted passages, images and private storage paths were not committed.

## Source verification

Every target passed all of these checks:

1. The EPUB ZIP archive passed CRC validation.
2. The exact navigation-document SHA-256 matched the edition digest already recorded in the repository.
3. The chapter target was resolved from the navigation document (EPUB 3 XHTML navigation or NCX content reference).
4. The target matched exactly one OPF manifest item.
5. The manifest item was present in the reading spine.
6. The original XHTML bytes were SHA-256 fingerprinted.
7. The summary was written in original Spanish prose and assigned a completed-through evidence watermark of chapter N; the reader cursor must reach chapter N+1.

| Work | Source asset | Edition | Navigation SHA-256 | Chapter | Relative XHTML target | Document SHA-256 | Unlock |
|---|---|---|---|---:|---|---|---:|
| El Imperio Final | cosmere.epub | cosmere-epub-merged-v1 | 85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee | 4 | EPUB/books/b000001/OEBPS/Text/004.xhtml | 6b729cfc609f926a4bac5b10f3eb5148a7c8935adde54f51f4ff13b9995b35d7 | 5 |
| El Camino de los Reyes | El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub | roshar-omnibus-v1 | 08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025 | 11 | OEBPS/Text/L1-025.xhtml | 3198740aafd799096672d6a893b925c08a4f33819219e7769761319eaea97ae5 | 12 |
| Danzante del Filo | 4 Danzante del Filo Brandon Sanderson.epub | edgedancer-epub-v1 | 5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517 | 12 | OEBPS/Text/012.xhtml | d02ecf9613cb9ae5ff8f95984b2a7bcdf56b19c72e9dcc6f193a1a959150155c | 13 |
| Esquirla del amanecer | 6 Esquirla del amanecer Brandon Sanderson.epub | dawnshard-epub-v1 | 8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075 | 12 | OEBPS/Text/12.xhtml | d5d73c0ebaaaeccf2dfbd2f16315aa521b860c043c0b61b971bbce76b7bc8990 | 13 |

## Staged summaries

The following four original summaries were added to src/hoid/editorialDrafts.ts:

- tfe.chapter-004.vin-kelsier-crew — summary SHA-256: 420948ca6f4486c61b164469da450da1c9f6e4ccc784648f35820b428ebdfab5
- twok.chapter-011.kaladin-returns-to-bridge-four — summary SHA-256: e0e20092570a2bfed23f187586e26104b518b8f877c7522fb82cb6823bd44648
- edgedancer.chapter-012.lift-gran-indicium-plan — summary SHA-256: 23234322951dafd172153245fbf57fb1729a9ae88229e7826cccc71d7b32e10e
- dawnshard.chapter-012.rysn-arrives-at-akinah — summary SHA-256: 206508815f555f56f13121f0979b5f0bb8a0bed2b618679b3c8d356979ee4e3a

All four records remain pending-review. Their summary text is stored only as original editorial prose in the staging module. The production editorial registry, approved-claim registry and activation receipt remain unchanged.

## Updated coverage

- Catalogue: 24 works.
- Verified numbered-chapter locators: 1,106.
- Individually inspected chapter documents: 39 across four works.
- Original staged summaries: 39, all pending review.
- Editorial review bundle: 57 metadata-only records (39 summaries, one atomic claim, 14 identity dossiers and three relationship claims).
- Approved production claims: zero.
- Production knowledge entries: zero.

The next continuation candidates are El Imperio Final chapter 5, El Camino de los Reyes chapter 12, Danzante del Filo chapter 13 and Esquirla del amanecer chapter 13. Candidate availability must still be checked through explicit local source selection.

## Spoiler and copyright boundary

A summary for chapter N remains locked until the reader reaches chapter N+1. Opening chapter N does not count as completing it. Each work keeps an independent reading boundary.

No source passage, chapter transcript, EPUB byte, XHTML body or image is included in this commit. No summary was approved automatically, no claim or relationship was promoted, and no reading progress was changed.
