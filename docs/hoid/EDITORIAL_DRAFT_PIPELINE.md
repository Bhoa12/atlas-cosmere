# Hoid editorial draft pipeline

## Purpose

The production evidence runtime may expose only original editorial claims that have passed an independent review. Source-derived notes are staged separately and are never imported by `editorialRegistry.ts`.

This run introduces the first source-backed draft from the accessible EPUB edition of **El camino de los reyes**. It is a draft, not approved production knowledge.

## Sources inspected

Three unique EPUB assets were available and inspected at chapter-one scope:

| Work | EPUB asset | Edition | Chapter locator | Chapter-document SHA-256 |
|---|---|---|---|---|
| `twok` — El camino de los reyes | `El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub` | `roshar-omnibus-v1` | `OEBPS/Text/L1-012.xhtml` | `0853a9469afe233d415645208f04bafb7f5dd5d603af9706c8924bcf14d27a70` |
| `edgedancer` — Danzante del Filo | `4 Danzante del Filo Brandon Sanderson.epub` | `edgedancer-epub-v1` | `OEBPS/Text/001.xhtml` | `8a85e1ccb126c5915f3948351266030b0966abb822403ddd0415791c671ce7dc` |
| `dawnshard` — Esquirla del amanecer | `6 Esquirla del amanecer Brandon Sanderson.epub` | `dawnshard-epub-v1` | `OEBPS/Text/1.xhtml` | `eac1f947b3303414b0b8a69ff19eabcd396c1fdd32caa1c1349c931eb8d8d2ae` |

The navigation documents are EPUB 3 XHTML for the omnibus and NCX for the two standalone novellas. Their SHA-256 values match the edition manifests already stored in `verifiedChapterLocators.ts`. The three chapter-document hashes are independently allowlisted in `verifiedChapterDocuments.ts`:

- `roshar-omnibus-v1`: `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`
- `edgedancer-epub-v1`: `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517`
- `dawnshard-epub-v1`: `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075`

Only metadata, relative locators and SHA-256 digests are committed. The EPUBs, chapter XHTML and source passages are not copied into the repository.

## First editorial batch

`src/hoid/editorialDrafts.ts` contains three original Spanish chapter-one summaries:

- `twok.chapter-001.cenn-battle` — the opening battle as seen by a young recruit;
- `edgedancer.chapter-001.lift-departure` — Lift's decision to leave the court and continue on her own path;
- `dawnshard.chapter-001.akinah-expedition` — Rysn's work, concern for Chiri-Chiri and the information that leads her to consider an expedition.

Each summary cites chapter 1 but unlocks at chapter 2. This matches the reader-boundary policy: while chapter 1 is open, chapter 1 is not yet considered completed.

The summaries are original editorial prose, not transcriptions or stored source excerpts. All three are marked `pending-review`.

## Review and promotion rules

A draft must pass all of the following before it can be considered for production:

1. Its bibliography work and first-appearance unit exist in the current edition manifest.
2. Its source locator matches the exact chapter unit in that edition.
3. Its navigation digest matches the edition manifest.
4. Its source-document digest exactly matches the sparse SHA-256 allowlist in `verifiedChapterDocuments.ts`, recorded by the offline ingestion step; a merely well-formed but unknown digest is rejected.
5. Its first appearance, source and unlock are all in the same work for draft schema v1; the first-appearance unit must have an exact locator, and the appearance cannot follow the unlock threshold. Cross-work chronology requires a future separately reviewed schema.
6. Its unlock threshold is a real unit in the same work and does not precede the source chapter.
7. Its summary is original editorial prose and contains no copied source passage.
8. An independent reviewer checks factual accuracy, completeness, originality and spoiler ceiling.
9. Only after review may a separate change add a knowledge entry and approved claim to `editorialRegistry.ts`.

The validator in `editorialDrafts.ts` deliberately accepts only `pending-review` records. It does not provide an API that promotes arbitrary runtime input into approved knowledge. Approval remains a separate source-controlled editorial action.

## Production isolation

- `HOID_EDITORIAL_DRAFTS` is staging-only.
- `editorialRegistry.ts` does not import the draft module.
- The production registry remains empty in this run.
- Hoid therefore continues to abstain when no approved claim exists.
- A provider cannot see or select a pending draft.

The tests assert that the pending summary is not returned by the production answer runtime and that the selector is not invoked.

## Initial source coverage and limitations (historical)

The three unique Roshar EPUBs are available in the Library and their navigation metadata is recorded in `verifiedChapterLocators.ts`. This run inspected chapter 1 of the omnibus and chapter 1 of each standalone novella only; it does not claim coverage of later chapters or of the other four main Roshar novels.

At the time of the initial ingestion batch, the private `cosmere.epub` was not present in that Library listing. Its bibliography entries and previously recorded structural metadata remain catalogue information; no new passage-level claim is created for those works in this run.

Both standalone Roshar novellas were inspected at chapter-one scope and each has one pending original summary. Their remaining chapters are not covered by this batch.

## Validation

Run:

```sh
npx vitest run src/hoid/editorialDrafts.test.ts src/hoid/verifiedChapterDocuments.test.ts src/hoid/editorialRegistry.test.ts src/hoid/evidenceScope.test.ts src/hoid/readingManifest.test.ts
```

The dedicated workflow also runs strict TypeScript checks over the draft validator and its provenance dependencies.

## Copyright boundary

Do not commit EPUBs, XHTML, copied paragraphs, chapter transcripts or extracted passage caches. Keep only bibliographic metadata, opaque navigation locators, cryptographic digests and original editorial summaries with explicit review status.


## Run 119 — chapter-six source ingestion

- Inspected chapter six in the three Roshar EPUB editions currently available in the Library.
- Revalidated each edition's existing navigation digest and resolved the exact chapter-six relative href from its TOC.
- Added only the chapter-body SHA-256 values to the sparse verified-document allowlist; no XHTML, passages or images are stored.
- Added three original Spanish summaries to staging for `twok`, `edgedancer` and `dawnshard`. Each summary is bound to its exact edition, chapter locator and document digest.
- The chapter-six summaries require chapter seven completion. Opening chapter seven is not enough; the v2 cursor authorizes only through chapter six.
- The staging inventory now contains 20 summaries backed by 20 individually inspected chapter documents: chapters one through six in the three Roshar works, plus chapters one and two of El Imperio Final.
- All 20 summaries remain pending review. Production registry and graph remain unchanged.
- The current Library listing did not expose `cosmere.epub`; no new Cosmere chapter was inspected.
- No EPUB bytes, XHTML bodies, copied passages or images were committed.


## Run 124 — current Roshar source coverage

The current Library copies of the Roshar omnibus, `Danzante del Filo` and `Esquirla del amanecer` were materialized for local read-only inspection. This run verified:
- `twok` chapter 8 at `Text/L1-021.xhtml`;
- `edgedancer` chapter 9 at `Text/009.xhtml`;
- `dawnshard` chapter 9 at `Text/9.xhtml`.

Each href was checked against the edition TOC, OPF manifest and spine. The original document bytes were SHA-256 hashed and added to the sparse allowlist. The navigation digests matched the previously recorded edition digests.

Three original Spanish summaries were added to staging. The `twok` chapter-eight summary unlocks after chapter nine is completed; the `edgedancer` and `dawnshard` chapter-nine summaries unlock after chapter ten is completed. All three remain `pending-review`.

The current staging inventory contains 32 original summaries backed by 32 individually inspected chapter documents: `twok` chapters 1–9, `edgedancer` and `dawnshard` chapters 1–10, and `tfe` chapters 1–3. No production registry entry was added.

The Run 124 Library listing exposed `cosmere.epub`, but the current Run 165 Library listing does not include it. No new Cosmere chapter body was available for inspection in this run, and no new Cosmere chapter summary is claimed.

See `docs/hoid/ROSHAR_CHAPTER_NINE_INGESTION.md` for the exact source metadata and document digests.


## Run 165 — Roshar chapter-nine through chapter-eleven ingestion

Six chapter bodies were inspected from the three current Library EPUBs. The existing navigation digests matched the edition manifests, and each exact relative href was confirmed in the OPF manifest and reading spine before the original XHTML bytes were hashed.

| Work | Chapter | Relative XHTML target | Document SHA-256 | Future unlock |
|---|---:|---|---|---:|
| El Camino de los Reyes | 9 | OEBPS/Text/L1-023.xhtml | c5737b3dc6b37d9bd9166d910f70c2f39f522ceb07123703387b34399e703945 | 10 |
| El Camino de los Reyes | 10 | OEBPS/Text/L1-024.xhtml | 9c01e31f6d72a910dc1c742609aaf107eaf63f83bb94b4a681df39c8fc08995d | 11 |
| Danzante del Filo | 10 | OEBPS/Text/010.xhtml | 4fe0dc1e86f52d76bcabef23c4b730ba15543db5491559eed44462b4dfbfe6bf | 11 |
| Danzante del Filo | 11 | OEBPS/Text/011.xhtml | 1b3d61d87c1a1d7f14f7199996d7751b88c4a1b19f5a2fd808d1bcf8b72bd673 | 12 |
| Esquirla del amanecer | 10 | OEBPS/Text/10.xhtml | 0f5c780ddda44ce97eb36d944182c2ffe80fb86867a00e60fc4143377dd9dd22 | 11 |
| Esquirla del amanecer | 11 | OEBPS/Text/11.xhtml | c12c49b2ad8813fe5d24894c6be43384e1da23875cf204e4129db9b5f20dddbc | 12 |

Six original Spanish summaries are staged with exact edition, locator, document and summary digests. All six remain pending review. The chapter-ten and chapter-eleven summaries remain locked until the reader reaches the following chapter.

The current staging inventory contains 39 summaries backed by 39 individually inspected chapter documents. At the time of Run 165, the Library listing did not include cosmere.epub, so no new Cosmere chapter was inspected. No EPUB bytes, XHTML bodies, copied passages or images were committed.

See docs/hoid/ROSHAR_CHAPTER_NINE_TEN_INGESTION.md and docs/hoid/ROSHAR_CHAPTER_TEN_ELEVEN_INGESTION.md for the exact source metadata.


## Run 168 — four new chapter summaries

Four additional source documents were inspected from the current Library copies. Each edition's recorded navigation digest matched the navigation document in the EPUB; each target was confirmed in the OPF manifest and reading spine before its exact original XHTML bytes were hashed.

| Work | Chapter | Relative XHTML target | Document SHA-256 | Future unlock |
|---|---:|---|---|---:|
| El Imperio Final | 4 | EPUB/books/b000001/OEBPS/Text/004.xhtml | 6b729cfc609f926a4bac5b10f3eb5148a7c8935adde54f51f4ff13b9995b35d7 | 5 |
| El Camino de los Reyes | 11 | OEBPS/Text/L1-025.xhtml | 3198740aafd799096672d6a893b925c08a4f33819219e7769761319eaea97ae5 | 12 |
| Danzante del Filo | 12 | OEBPS/Text/012.xhtml | d02ecf9613cb9ae5ff8f95984b2a7bcdf56b19c72e9dcc6f193a1a959150155c | 13 |
| Esquirla del amanecer | 12 | OEBPS/Text/12.xhtml | d5d73c0ebaaaeccf2dfbd2f16315aa521b860c043c0b61b971bbce76b7bc8990 | 13 |

Four original Spanish summaries were added to editorialDrafts.ts. Each is bound to its own work, chapter locator, edition navigation digest, exact document digest and summary digest. All remain pending review. A chapter-N summary stays locked until the reader reaches chapter N+1; the chapter itself is not considered completed merely because it is open.

The new batch raises the staging inventory to 39 summaries backed by 39 individually inspected chapter documents. No production registry, approved claim, graph edge, reading progress or activation receipt was changed. No EPUB, XHTML body, copied passage, extracted text or image is committed.


## Run 169 — chapter unlock coordinate system

For a summary sourced from chapter N, the evidence unlock watermark is N (completed through N). The reader's open cursor must advance to N+1. Do not store N+1 in `evidenceUnlock`: that field is not the open cursor and doing so delays the summary until after chapter N+1 is completed.


## Run 170 — Cosmere and Roshar source expansion

The current Library listing contained `cosmere.epub`, the Roshar omnibus, and the standalone EPUBs for Danzante del Filo and Esquirla del amanecer. The four navigation-document digests matched their edition-bound allowlist values. Each target was resolved from the navigation document, matched to exactly one OPF manifest item, confirmed in the reading spine, and fingerprinted from its original XHTML bytes.

| Work | Chapter | Relative XHTML target | Document SHA-256 | Evidence watermark | Minimum open cursor |
|---|---:|---|---|---:|---:|
| El Imperio Final | 5 | EPUB/books/b000001/OEBPS/Text/005.xhtml | ec48d5ed29ede0760a63d913fcc71d79c908d879fe62841fe6cbfc64d90676d8 | 5 | 6 |
| El Camino de los Reyes | 12 | OEBPS/Text/L1-032.xhtml | 1f220d29b388c67834fb11d21fdb120407d1220531d735f946c00cc26223e838 | 12 | 13 |
| Danzante del Filo | 13 | OEBPS/Text/013.xhtml | 341ffa8144efe7c054d92bbedd54246889a92b268db7b62118f6b651095a516d | 13 | 14 |
| Esquirla del amanecer | 13 | OEBPS/Text/13.xhtml | e0a97fb4d28b90b99169e6afcdf4fbd3e42b67c1ff5b0c61e0cb4aad6405544c | 13 | 14 |

Four original Spanish summaries were added to `editorialDrafts.ts` with exact summary SHA-256 values, edition-bound locators and source-document digests. They are `tfe.chapter-005.kelsier-venture-atium`, `twok.chapter-012.adolin-abismoid-hunt`, `edgedancer.chapter-013.lift-emperor-decree` and `dawnshard.chapter-013.lopen-akinah-landing`.

All four remain pending independent editorial review. For source chapter N, the evidence watermark is N and the reader's open cursor must reach N+1. A cursor at N still leaves that chapter's summary locked. The integration regression also proves that another work's progress cannot unlock the evidence.

The staging inventory now contains 43 original summaries backed by 43 individually inspected chapter documents. Production knowledge, approved claims and activation receipts remain unchanged. No EPUB, XHTML body, copied passage, extracted source prose, image or private file path was committed.


## Run 174 — three new chapter summaries

Three additional source documents were inspected from the current Library copies. The registered navigation digests matched the EPUB navigation documents; each target was resolved from its table of contents, matched to one OPF manifest item, confirmed in the reading spine and fingerprinted from its original XHTML bytes.

| Work | Chapter | Relative XHTML target | Document SHA-256 | Evidence watermark | Minimum open cursor |
|---|---:|---|---|---:|---:|
| El Camino de los Reyes | 13 | OEBPS/Text/L1-033.xhtml | 9716f41c822b8ea3801fd18d6072689d90482db419fd90d869fb12d8543da426 | 13 | 14 |
| Danzante del Filo | 14 | OEBPS/Text/014.xhtml | 0c716a985a6f3ec2478788463d4b2ef132088829ce5d338101b0df9169edc17c | 14 | 15 |
| Esquirla del amanecer | 14 | OEBPS/Text/14.xhtml | c62b4deedaa65671b41e69e944a5fb384f71cbfef4807d7d7ffd013b21225fb5 | 14 | 15 |

Three original Spanish summaries were added to `editorialDrafts.ts` with exact summary SHA-256 values, edition-bound locators and source-document digests. All remain pending independent review. The evidence watermark is N; the reader cursor must reach N+1. No progress, production registry, approved claim or activation receipt was changed.

The staging inventory now contains 46 original summaries backed by 46 individually inspected chapter documents. No EPUB bytes, XHTML bodies, copied passages, extracted source prose, images or private file paths were committed. See [RUN174_ROSHAR_CHAPTER_EXPANSION.md](RUN174_ROSHAR_CHAPTER_EXPANSION.md).


## Run 175 — evidencia de capítulo y revisión

Se incorporan cuatro resúmenes originales nuevos, cada uno vinculado a un XHTML concreto mediante edición, huella de navegación, localizador y SHA-256 del documento. Los cuatro permanecen en `pending-review`.

La inspección local devuelve únicamente una huella candidate-only. La allowlist y el staging editorial se actualizan explícitamente, pero ninguna de las dos acciones concede aprobación ni escritura en producción. El umbral sigue siendo capítulo N+1.


## Run 176 — tres nuevos resúmenes de capítulo

Los tres nuevos documentos se resolvieron desde las navegaciones registradas, se encontraron en sus manifiestos OPF y reading spines, y se fingerprintaron desde los bytes XHTML originales.

| Obra | Capítulo | XHTML relativo | SHA-256 del documento | SHA-256 del resumen | Watermark | Cursor mínimo |
|---|---:|---|---|---|---:|---:|
| El Camino de los Reyes | 15 | `L1-035.xhtml` | `43ff1d4f608fb3ec230923d92edadd09bc3c9606d72d506b547c7be43266f492` | `425a4b6233aa3b38315517543e7a7992ccc910cd3d13de5d53a1e43a07dcd50b` | 15 | 16 |
| Danzante del Filo | 16 | `Text/016.xhtml` | `d3a247b59d08735b83baa9840ef9e5058cc3f2108c931d66f06d370c4d41a4dd` | `bbb171095d991631090ae39f88218a8b9e561492828ee023ede17e4c42c24544` | 16 | 17 |
| Esquirla del amanecer | 16 | `Text/16.xhtml` | `d62fefc1ce3e6eab0a0cfa5fa8e08819d5d5a9d3a2b2d12015ffaa9411cd18a2` | `d83caf4c8c8082df409fc78abc5b69e3f7a96068742d562048806276973fbbc0` | 16 | 17 |

Los identificadores son `twok.chapter-015.adolin-aftermath-gavilar-message`, `edgedancer.chapter-016.lift-pursues-skybreakers` y `dawnshard.chapter-016.rysn-mural-acceptance`. Los tres resúmenes permanecen pendientes de revisión independiente. El inventario contiene 53 resúmenes respaldados por 53 documentos inspeccionados. No se ha aprobado ninguna afirmación ni se ha escrito conocimiento en producción.


## Run 178 — El Imperio Final chapter seven

The current Library copy of `cosmere.epub` was available for a candidate-only local inspection. The container passed a full ZIP CRC check. Its `EPUB/nav.xhtml` digest matched the registered Cosmere edition. Chapter 7 resolved to one OPF manifest item and was present in the reading spine; the exact XHTML bytes were fingerprinted independently.

One original Spanish summary, `tfe.chapter-007.marsh-vin-training`, was added to `HOID_EDITORIAL_DRAFTS`. It is bound to the edition ID, navigation digest, chapter-7 locator and exact document digest. The completed-through watermark is 7, so the minimum open reader cursor is chapter 8. The draft remains `pending-review` and is not imported into the production registry.

No EPUB bytes, XHTML body, copied passage, extracted source text, image or private file path was committed. The source file was used only in the local inspection environment.

## Run 191 — three new Roshar chapter drafts

Three additional chapter documents were inspected from the private Library copies after revalidating the registered edition navigation digests, the previous chapter fingerprints, the OPF manifest entries and the reading-spine membership.

| Work | Chapter | XHTML target | Document SHA-256 | Summary SHA-256 | Unlock cursor |
|---|---:|---|---|---|---:|
| El Camino de los Reyes | 16 | `Text/L1-037.xhtml` | `1f9d38db4cde7a471586ff7ed5d88cbef7a72b3616020ca1c4d8f06093e7da32` | `0144eabf67c561f71884fb03a523cbf5d8f42f8458dc72fe3aded5bb64d99076` | 17 |
| Danzante del Filo | 17 | `Text/017.xhtml` | `250c26f671df7422277711bbefd1f72a381a5dd1791bb28d9efb50e7e8c1352c` | `03d9f250332a63ef25c0a8a592b1d1d3d0a08ab3fd511e4db138ba4b13b29576` | 18 |
| Esquirla del amanecer | 17 | `Text/17.xhtml` | `85fe1ee6a0224ef0ebc04c8f3e327e30a6553f2623a7482be66d5a4e1b2af840` | `c341e1d3a83e251680ad04e2b80cdc95d5ade8cff1e1faf58dec3bd9520c3495` | 18 |

The three summaries are original editorial prose and remain `pending-review`. No source passage or XHTML body is stored in the repository. No draft is promoted into the production registry.

