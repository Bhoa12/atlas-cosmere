# Run 231 — El Camino de los Reyes chapter 20 inspection and editorial staging

## Base and isolation

- Repository: `Bhoa12/atlas-cosmere`
- Branch: `feat/hoid-ia-core-run231`
- Base branch: `feat/hoid-ia-core-run230`
- Base commit: `07a08366a62ad3bfcaeddc1886e13c2906b091d1`
- `main` and PR #123 were not modified.

## Source verification

The Library contained the Roshar omnibus EPUB used for the registered edition `roshar-omnibus-v1`. The archive passed ZIP CRC validation. Its navigation document SHA-256 matched the registered value:

`08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`

Before inspecting the next chapter, the existing El Camino de los Reyes chapter-19 document digest was recomputed and matched:

`075a2440369deb756c3aab32e76596eb85c1c1e4e45c2255a8edf5447a1a9867`

## Chapter 20 document

The exact navigation entry resolved to `Text/L1-042.xhtml`. It appeared exactly once in the navigation document, matched exactly one OPF manifest item, and that item appeared exactly once in the reading spine.

| Work | Chapter | Relative XHTML target | Bytes | SHA-256 |
|---|---:|---|---:|---|
| El Camino de los Reyes | 20 | `Text/L1-042.xhtml` | 6,043 | `54d359607c877ed3312095477855b1d824dab6e4f699d9a9f76979254b76f81d` |

## Original summary staging

One original Spanish summary was added to `src/hoid/editorialDrafts.ts`:

- `twok.chapter-020.kaladin-cannot-save-miasal`

The summary is bound to the exact edition ID, navigation digest, chapter locator, document digest and summary digest. Its review status is `pending-review`. Its evidence watermark is chapter 20, so the earliest eligible reader cursor is chapter 21. It is not included in the production evidence runtime.

## Coverage after Run 231

- 24 catalogue works.
- 1,106 verified numbered-chapter navigation locators.
- 69 individually inspected chapter documents across four works.
- 65 original summaries in staging; all 65 remain pending independent review.
- 0 approved production claims.
- 0 production knowledge entries.
- No activation receipt.
- Danzante del Filo is complete only within its 20 numbered manifest units.
- Esquirla del amanecer is complete only within its 19 numbered manifest units.
- Next continuation tasks: El Imperio Final chapter 11 and El Camino de los Reyes chapter 21.

## CI repair carried forward

The Run 230 final-head checks exposed stale assertions in two shared test files:

- `verifiedChapterDocuments.test.ts` still expected already inspected chapter fingerprints to be absent.
- `editorialDrafts.test.ts` still expected the earlier 62-summary digest batch after two additional summaries had been staged.

Those stale expectations caused failures in multiple dependent workflows. Run 231 updates the assertions, explicitly verifies the newly inspected chapter-20 digest, and retains negative tests for genuinely uninspected chapters. No spoiler gate, source validator or production policy was weakened.

## Copyright and data handling

No EPUB, XHTML body, extracted prose, chapter title, copied passage, image or private device URI was committed. Only original summary prose, edition-bound metadata, relative navigation locator and cryptographic digests were added. The selected local EPUB was used only for this inspection and was not copied into the repository.

No reading progress, spoiler authorization, approved claim, production knowledge entry or activation receipt was changed.
