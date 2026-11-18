# Run 124 — Roshar chapter-body ingestion

## Source editions inspected

The current Library copies were materialized for local, read-only inspection:

| Work ID | Private EPUB filename | Edition ID | Navigation source |
|---|---|---|---|
| `twok` | `El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub` | `roshar-omnibus-v1` | `OEBPS/Text/nav.xhtml` |
| `edgedancer` | `4 Danzante del Filo Brandon Sanderson.epub` | `edgedancer-epub-v1` | `OEBPS/toc.ncx` |
| `dawnshard` | `6 Esquirla del amanecer Brandon Sanderson.epub` | `dawnshard-epub-v1` | `OEBPS/toc.ncx` |

The three navigation SHA-256 digests were recomputed from the current files and matched the existing edition records:

- `twok`: `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`
- `edgedancer`: `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517`
- `dawnshard`: `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075`

## Newly inspected chapter documents

Each selected relative href was independently found in the edition TOC, matched to an OPF manifest item, and confirmed in the OPF spine before its original bytes were hashed.

| Work | Numbered chapter | Relative href | Document SHA-256 | Unlock threshold |
|---|---:|---|---|---:|
| `twok` | 8 | `Text/L1-021.xhtml` | `1f9ad886ddb35ccb723890b8b8b4fd2c8f959182c26e0bef112a01d69736a156` | 9 |
| `edgedancer` | 9 | `Text/009.xhtml` | `3561810a0d4efb150309a41393dd612a8edca55806c98395152e1b88e5e8949d` | 10 |
| `dawnshard` | 9 | `Text/9.xhtml` | `4ee69a012acd0e528aa63c5ac3f78cd22a0988e168f178606dc48a4691786906` | 10 |

Edition-bound locator IDs:

- `nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-021.xhtml`
- `nav:edgedancer-epub-v1:5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517:Text/009.xhtml`
- `nav:dawnshard-epub-v1:8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075:Text/9.xhtml`

The digests are stored in the sparse allowlist `verifiedChapterDocuments.ts`. The existing TOC locator registry already contained these relative hrefs; no locator or edition digest was inferred or changed.

## Original editorial drafts

Three original Spanish summaries were added to `editorialDrafts.ts`:

- `twok.chapter-008.shallan-jasnah-pupil`
- `edgedancer.chapter-009.lift-nale-szeth`
- `dawnshard.chapter-009.rysn-aluminum-fabrial`

All remain `pending-review`. The chapter-eight summary requires chapter nine to be completed. The two chapter-nine summaries require chapter ten to be completed. Opening the unlock chapter is not sufficient: the cursor-native boundary authorizes only through the chapter before the one currently open.

The staging inventory now contains 29 original summaries backed by 29 individually inspected chapter documents: chapters 1–8 of `twok`, chapters 1–9 of `edgedancer` and `dawnshard`, and chapters 1–3 of `tfe`.

## Scope and exclusions

- This run inspected only the three chapter documents listed above.
- It does not claim that any of the three books is fully ingested.
- The two standalone novellas were read from the current Library copies; the omnibus edition was used for `twok`.
- No EPUB, XHTML body, copied passage, chapter transcript or image was committed.
- Only edition metadata, relative locators, SHA-256 digests and original summaries were added.
- No draft was promoted to `editorialRegistry.ts`; production knowledge remains unchanged.
