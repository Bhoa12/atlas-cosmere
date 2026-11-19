# Run 165 — Roshar chapter-ten and chapter-eleven inspection

## Source assets

The same three unique Roshar EPUBs used for the chapter-nine/ten batch were rechecked read-only. Their navigation-document digests still match the registered edition digests.

| Work | Edition ID | Navigation document | Navigation SHA-256 |
|---|---|---|---|
| El Camino de los Reyes | roshar-omnibus-v1 | OEBPS/Text/nav.xhtml | 08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025 |
| Danzante del Filo | edgedancer-epub-v1 | OEBPS/toc.ncx | 5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517 |
| Esquirla del amanecer | dawnshard-epub-v1 | OEBPS/toc.ncx | 8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075 |

## Exact chapter targets

Each target was resolved from its edition's navigation document, confirmed as XHTML in the OPF manifest, confirmed in the reading spine, and hashed from the exact archive bytes.

| Work | Chapter | TOC label | Relative XHTML target | Bytes | Document SHA-256 | Earliest reader chapter |
|---|---:|---|---|---:|---|---:|
| El Camino de los Reyes | 10 | 10. Historias de cirujanos | OEBPS/Text/L1-024.xhtml | 16,285 | 9c01e31f6d72a910dc1c742609aaf107eaf63f83bb94b4a681df39c8fc08995d | 11 |
| Danzante del Filo | 11 | Capítulo 11 | OEBPS/Text/011.xhtml | 6,785 | 1b3d61d87c1a1d7f14f7199996d7751b88c4a1b19f5a2fd808d1bcf8b72bd673 | 12 |
| Esquirla del amanecer | 11 | 11 | OEBPS/Text/11.xhtml | 18,107 | c12c49b2ad8813fe5d24894c6be43384e1da23875cf204e4129db9b5f20dddbc | 12 |

## Original summaries staged

| Draft ID | Chapter scope | Unlock | Review status |
|---|---:|---:|---|
| twok.chapter-010.kaladin-lirin-surgeon | El Camino de los Reyes 10 | 11 | pending-review |
| edgedancer.chapter-011.lift-finds-great-indicium | Danzante del Filo 11 | 12 | pending-review |
| dawnshard.chapter-011.lopen-crosses-akinah-storm | Esquirla del amanecer 11 | 12 | pending-review |

The summaries are original Spanish editorial prose. They are bound to exact edition, navigation, chapter locator, document and summary digests. They contain no copied chapter passages.

## Spoiler boundaries

- El Camino de los Reyes chapter 10 is unavailable until the reader reaches chapter 11.
- Danzante del Filo chapter 11 is unavailable until the reader reaches chapter 12.
- Esquirla del amanecer chapter 11 is unavailable until the reader reaches chapter 12.
- The chapter cursors remain independent; progress in one work cannot unlock another.
- All three records remain pending review and are excluded from production knowledge.

## Coverage after the second Run 165 batch

- El Camino de los Reyes: chapters 1–10 inspected and staged.
- Danzante del Filo: chapters 1–11 inspected and staged.
- Esquirla del amanecer: chapters 1–11 inspected and staged.
- Total individually inspected chapter documents: 35 across four works.
- Total original staged summaries: 35; all remain pending review.
- Approved claims: 0.
- Production knowledge entries: 0.

The current Library listing did not include cosmere.epub. No new Cosmere chapter was inspected or inferred from catalogue metadata.

## Integrity and copyright boundary

Only original summaries, edition metadata, relative locators, cryptographic digests and review status are committed. No EPUB bytes, XHTML body, copied passage, extracted text, image or private file URI is included.
