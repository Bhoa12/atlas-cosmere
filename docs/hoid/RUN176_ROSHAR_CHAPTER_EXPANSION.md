# Run 176 — Roshar chapter expansion

## Scope

Run 176 continues the existing edition-bound, candidate-only EPUB inspection workflow. Three private Roshar EPUBs were selected from the Library and inspected locally. No EPUB, XHTML body, extracted passage, image or private file URI was committed.

## Source verification

All three ZIP containers passed CRC testing. Their registered navigation-document SHA-256 values matched the exact editions already recorded in the catalogue. For each new chapter, the navigation target was resolved from the registered TOC, matched to exactly one OPF manifest item, confirmed in the reading spine, and fingerprinted from the original XHTML bytes.

The previously recorded final chapter digest for each work was recomputed from the same selected EPUB and matched the existing allowlist, confirming continuity with the registered edition.

| Work | Chapter | Relative XHTML target | Navigation SHA-256 | Document SHA-256 |
|---|---:|---|---|---|
| El Camino de los Reyes | 15 | `L1-035.xhtml` | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` | `43ff1d4f608fb3ec230923d92edadd09bc3c9606d72d506b547c7be43266f492` |
| Danzante del Filo | 16 | `Text/016.xhtml` | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` | `d3a247b59d08735b83baa9840ef9e5058cc3f2108c931d66f06d370c4d41a4dd` |
| Esquirla del amanecer | 16 | `Text/16.xhtml` | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` | `d62fefc1ce3e6eab0a0cfa5fa8e08819d5d5a9d3a2b2d12015ffaa9411cd18a2` |

## Editorial staging

Three original Spanish summaries were added to `src/hoid/editorialDrafts.ts`:

| Draft ID | Source chapter | Summary SHA-256 | Evidence watermark | Minimum open cursor |
|---|---:|---|---:|---:|
| `twok.chapter-015.adolin-aftermath-gavilar-message` | 15 | `425a4b6233aa3b38315517543e7a7992ccc910cd3d13de5d53a1e43a07dcd50b` | 15 | 16 |
| `edgedancer.chapter-016.lift-pursues-skybreakers` | 16 | `bbb171095d991631090ae39f88218a8b9e561492828ee023ede17e4c42c24544` | 16 | 17 |
| `dawnshard.chapter-016.rysn-mural-acceptance` | 16 | `d83caf4c8c8082df409fc78abc5b69e3f7a96068742d562048806276973fbbc0` | 16 | 17 |

All three drafts remain `pending-review`. They are not approved claims and are not present in the production knowledge registry. The evidence watermark is the completed-through chapter N; the open cursor must reach N+1. The reading-boundary integration tests also confirm that another book's progress cannot unlock these summaries.

## Inventory after Run 176

| Measure | Value |
|---|---:|
| Catalogue works | 24 |
| Verified navigation locators | 1,106 |
| Individually inspected chapter documents | 53 |
| Original staged summaries | 53 |
| Pending-review summaries | 53 |
| Atomic claims approved | 0 |
| Production knowledge entries | 0 |
| Activation receipt | `null` |

The four works with individually inspected chapter documents remain El Imperio Final, El Camino de los Reyes, Danzante del Filo and Esquirla del amanecer.

## Source availability limitation

The current Library and conversation-file inventory did not surface `cosmere.epub`. Therefore El Imperio Final chapter 7 remains a metadata-only candidate in the ingestion plan and was not inspected in this run. No chapter digest or summary was invented for it.

The next continuation candidates are El Imperio Final chapter 7, El Camino de los Reyes chapter 16, Danzante del Filo chapter 17 and Esquirla del amanecer chapter 17. These remain candidates only; each still requires explicit local source selection and the candidate-only inspection process.

## Safety and privacy

- No reader progress was changed.
- No source passage or chapter text was committed.
- No EPUB or XHTML file was uploaded to GitHub.
- No editorial draft was approved.
- No production knowledge or activation receipt was created.
- Existing spoiler boundaries and edition binding remain unchanged.
