# Run 232 — El Camino de los Reyes chapter 21 inspection and editorial staging

## Source verification

The Library contained the Roshar omnibus EPUB for the registered edition roshar-omnibus-v1. The archive passed ZIP CRC validation. Its navigation document SHA-256 matched the registered value:

08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025

Before inspecting the next chapter, the existing chapter-20 document digest was recomputed and matched:

54d359607c877ed3312095477855b1d824dab6e4f699d9a9f76979254b76f81d

## Chapter 21 document

The navigation entry for chapter 21 resolved to L1-043.xhtml. It appeared exactly once in the EPUB navigation, matched exactly one OPF manifest item and that manifest item appeared in the reading spine.

| Work | Chapter | Relative XHTML target | Bytes | SHA-256 |
|---|---:|---|---:|---|
| El Camino de los Reyes | 21 | Text/L1-043.xhtml | 31,523 | 08954cd89c6ec48a8de4e6114338593cf65279acc5c17afd79627c1e827c761b |

## Original summary staging

One original Spanish summary was added to src/hoid/editorialDrafts.ts:

- twok.chapter-021.kaladin-gathers-teft-for-a-secret-plan

Its UTF-8 summary SHA-256 is a9686d904b5cc7258477b6db18e7d965624dfa1d5051e2d380294909c101cbbd. The summary is bound to the exact edition ID, navigation digest, chapter locator and document digest. Its review status is pending-review. Its evidence watermark is chapter 21, so the earliest eligible reader cursor is chapter 22. It is not included in the production evidence runtime.

## Coverage after Run 232

- 24 catalogue works.
- 1,106 verified numbered-chapter navigation locators.
- 70 individually inspected chapter documents across four works.
- 66 original summaries in staging; all 66 remain pending independent review.
- 0 approved production claims.
- 0 production knowledge entries.
- No activation receipt.
- Danzante del Filo is complete only within its 20 numbered manifest units.
- Esquirla del amanecer is complete only within its 19 numbered manifest units.
- Next continuation tasks: El Imperio Final chapter 11 and El Camino de los Reyes chapter 22.

The current EPUB-filtered Library listing did not contain cosmere.epub; no new El Imperio Final chapter was inspected.

## Safety and copyright

No EPUB, XHTML body, extracted prose, chapter title, copied passage, image or private device URI was committed. Only the edition-bound document digest, relative navigation locator and original editorial summary metadata were added. The summary remains pending review and the production knowledge registry remains empty.

No reading progress, spoiler authorization, approved claim or activation receipt was changed.
