# Run 175 — Source execution and knowledge expansion

## Base and isolation

- Repository: `Bhoa12/atlas-cosmere`
- Branch: `feat/hoid-ia-core-run175`
- Base branch: `feat/hoid-ia-core-run174`
- Base commit: `5ba6d571bfc8190aa0a52b8acdc70775b842056f`
- Main was not modified.

## Private EPUB verification

The four supplied private EPUBs were available in the user's Library. Their navigation fingerprints match the registered editions:

| Work | Edition | Navigation SHA-256 |
|---|---|---|
| El Imperio Final | `cosmere-epub-merged-v1` | `85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee` |
| El Camino de los Reyes | `roshar-omnibus-v1` | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` |
| Danzante del Filo | `edgedancer-epub-v1` | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` |
| Esquirla del amanecer | `dawnshard-epub-v1` | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` |

Each new XHTML document was present in the selected EPUB's OPF manifest and reading spine. The prior chapter digest in the existing allowlist was recomputed from the same EPUB and matched.

## Four chapter documents added

| Work | Chapter | Relative navigation href | XHTML SHA-256 |
|---|---:|---|---|
| El Imperio Final | 6 | `books/b000001/OEBPS/Text/006.xhtml` | `8b8596f106ac9f0510624c86849750358a934ab064036f91a70189378deda299` |
| El Camino de los Reyes | 14 | `L1-034.xhtml` | `6b5e5693ebbf7825cdbf9b0be1538641e8e412bfe8aba322453a80ec113d5e4e` |
| Danzante del Filo | 15 | `Text/015.xhtml` | `0cf7efadeb8eae0c6c3563cb0bd5e7beef853bb1d75dfa69ba6734af7c7aa786` |
| Esquirla del amanecer | 15 | `Text/15.xhtml` | `8ddd62ba14191c2a333e6da18beabc5205f50b6aa45472cfd16e25e6ba573dd5` |

No EPUB, XHTML, source passage, extracted body text or binary content was added to Git.

## Editorial staging

Four original Spanish summaries were added, each with an exact source locator, edition, navigation/document hashes, summary hash and `pending-review` state:

- `tfe.chapter-006.kelsier-rebellion-plan`
- `twok.chapter-014.kaladin-bridge-four-training`
- `edgedancer.chapter-015.lift-follows-skybreakers`
- `dawnshard.chapter-015.akinah-hidden-oathgate`

All four remain pending independent review. No claim was approved and no production registry was populated.

## Candidate-only local execution

Added `src/hoid/sourceIngestionExecution.ts` and tests. The function accepts only a current canonical plan task, an explicit source descriptor, and a package candidate issued by the same ingestion service. It revalidates the edition-bound locator and returned chapter fingerprint.

The result contains metadata and digests only. It cannot create a summary, alter reading progress, extend the verified-document allowlist, or promote knowledge. The Expo local EPUB panel now exposes an explicit action to inspect the next planned chapter and displays only the chapter number and digest prefix.

## Spoiler boundary

The four new summaries remain blocked while their source chapter is open and become eligible only when the same work's cursor reaches chapter N+1. Progress in another work cannot unlock them.

Tests that need an uninspected chapter derive the first missing chapter from the current allowlist rather than hard-coding a chapter number.

## Inventory after Run 175

- 24 catalogue works.
- 1,106 verified numbered navigation locators.
- 50 individually inspected chapter documents.
- 50 original summaries in editorial staging.
- 50 summaries pending review.
- 0 approved claims.
- 0 production knowledge entries.
- no activation receipt.


## Editorial wording verification

After re-reading the four inspected XHTML documents, two summary phrases were narrowed to match the source more precisely: the El Imperio Final chapter refers to the Lord Legislator's army, and the Danzante del Filo chapter refers to the disciples of Oscuridad. The corresponding summary hashes were recomputed. Source-document hashes and chapter boundaries are unchanged; all four drafts remain pending review.
