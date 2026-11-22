# Run 230 — Roshar chapter 19/20 source inspection and editorial staging

## Base and isolation

- Repository: `Bhoa12/atlas-cosmere`
- Branch: `feat/hoid-ia-core-run230`
- Base branch: `feat/hoid-ia-core-run229`
- Base commit: `42548676ec3eafd9823d984ac842a41bba06f790`
- `main` was not modified.
- PR #122 remains open and unchanged.

## Sources available in this run

The current Library listing filtered to `application/epub+zip` returned the Roshar omnibus and Danzante del Filo EPUBs, including duplicate Library copies. One copy of each registered edition was selected for this run. Both ZIP archives passed CRC validation.

The Cosmere EPUB was not present in that current filtered listing. No El Imperio Final chapter 11 inspection is claimed; it remains a metadata-only candidate.

## Edition and document verification

The Roshar omnibus navigation SHA-256 matched the registered edition value:

`08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`

The Danzante del Filo NCX SHA-256 matched its registered edition value:

`5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517`

For each target, the exact navigation entry resolved to exactly one OPF manifest item and that item was present in the reading spine. The preceding chapter's raw XHTML digest matched the existing allowlist before the next chapter was fingerprinted.

| Work | Chapter | Relative XHTML target | Bytes | SHA-256 |
|---|---:|---|---:|---|
| El Camino de los Reyes | 19 | `Text/L1-041.xhtml` | 41,194 | `075a2440369deb756c3aab32e76596eb85c1c1e4e45c2255a8edf5447a1a9867` |
| Danzante del Filo | 20 | `Text/020.xhtml` | 14,795 | `db048fc62821ddc627d004048f608b8cc55aa2465cebca4c318ac38d1bbf6c63` |

## Original summaries added to staging

Two original Spanish summaries were added to `src/hoid/editorialDrafts.ts`:

- `twok.chapter-019.dalinar-ancient-vision-and-radiants`
- `edgedancer.chapter-020.lift-returns-to-azimir-and-aids-refugees`

Each draft carries the exact edition ID, navigation digest, chapter locator, document digest and summary digest. Both have `review.status = pending-review`. Their evidence watermark is chapter N, so the minimum reader cursor remains N+1. Neither draft is passed to the production evidence runtime.

No summary was promoted. The production editorial registry and approved-claim registry remain empty.

## Coverage after Run 230

- 24 catalogue works.
- 1,106 verified numbered-chapter navigation locators.
- 68 individually inspected chapter documents across four works.
- 64 original summaries in staging; all 64 remain pending independent review.
- 0 approved production claims.
- 0 production knowledge entries.
- No activation receipt.
- Esquirla del amanecer remains complete only within its 19 numbered manifest units.

The next continuation queue is El Imperio Final chapter 11, El Camino de los Reyes chapter 20 and Danzante del Filo chapter 21.

## Copyright and data handling

No EPUB, XHTML body, extracted prose, chapter title, copied passage, image or private device URI was committed. Only original summaries, edition-bound metadata, opaque locators and cryptographic digests were added. The locally materialized EPUB copies were used only for this inspection and were not copied into the repository.
