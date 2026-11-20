# Hoid source coverage and evidence completeness

## Purpose

This audit makes the difference between catalogue presence, edition structure, navigation locators, individually inspected chapter documents, editorial staging and production knowledge explicit.

It is a metadata-only report. It is not a knowledge retrieval API, does not authorize a claim, and must never be used to unlock a chapter. `HoidEvidenceRuntime` and the existing per-work progress checks remain the only narrative authorization boundary.

## Current inventory

The checked-in catalogue contains 24 works: 17 assigned to `cosmere.epub` and 7 assigned to the Roshar EPUB sources.

| Coverage layer | Current inventory | What it proves |
|---|---:|---|
| Bibliography entries | 24 | Work identity and source group are catalogued |
| Edition structures | 24 | A conservative progress policy is recorded for every catalogue work |
| Verified numbered-chapter locators | 1,106 | Relative navigation hrefs are bound to an edition and navigation digest |
| Works with at least one verified locator | 20 | Navigation metadata exists for those work IDs |
| Individually inspected chapter documents | 59 | Exact XHTML document bytes were inspected and fingerprinted |
| Works with inspected chapter documents | 4 | Body-level inspection is limited to those four works |
| Original staged chapter summaries | 59 | Original editorial summaries exist in staging |
| Summaries pending review | 59 | None of those summaries is approved for production |
| Production knowledge entries | 0 | No narrative knowledge entry is active |
| Approved production claims | 0 | No claim can currently be served as verified narrative knowledge |

The 1,106 locators comprise 653 Cosmere locators and 453 Roshar locators. A locator verifies a navigation target only. It does not prove that the corresponding chapter body has been inspected.

## Per-work inventory

Counts are: verified navigation locators / individually inspected chapter documents / staged summaries.

### `cosmere.epub`

| Work ID | Work | Locators | Inspected bodies | Staged summaries | Progress limitation |
|---|---|---:|---:|---:|---|
| `tfe` | El Imperio Final | 38 | 8 | 8 | Numeric chapters |
| `woa` | El Pozo de la Ascensión | 59 | 0 | 0 | Numeric chapters |
| `hoa` | El Héroe de las Eras | 82 | 0 | 0 | Numeric chapters |
| `aol` | Aleación de ley | 20 | 0 | 0 | Numeric chapters |
| `sos` | Sombras de identidad | 26 | 0 | 0 | Numeric chapters |
| `bom` | Brazales de Duelo | 31 | 0 | 0 | Numeric chapters |
| `tlm` | El metal perdido | 74 | 0 | 0 | Numeric chapters |
| `warbreaker` | El aliento de los dioses | 58 | 0 | 0 | Numeric chapters |
| `elantris` | Elantris | 47 | 0 | 0 | Only the unambiguous numeric prefix 1–47 is enabled; 48, 51 and 57 have duplicate locators |
| `white-sand-1` | Arena blanca vol. 1 | 0 | 0 | 0 | Volume segmentation required |
| `white-sand-2` | Arena blanca vol. 2 | 0 | 0 | 0 | Volume segmentation required |
| `white-sand-3` | Arena blanca vol. 3 | 0 | 0 | 0 | Volume segmentation required |
| `tress` | Trenza del mar Esmeralda | 64 | 0 | 0 | Numeric chapters |
| `yumi` | Yumi y el pintor de pesadillas | 41 | 0 | 0 | Numeric chapters |
| `sunlit` | El Hombre Iluminado | 52 | 0 | 0 | Numeric chapters |
| `isles` | Islas de la ascuaoscura | 61 | 0 | 0 | Numeric chapters |
| `arcanum` | Arcanum ilimitado | 0 | 0 | 0 | Collection sections need independent cursors |

### Roshar EPUBs

| Work ID | Work | Locators | Inspected bodies | Staged summaries | Progress limitation |
|---|---|---:|---:|---:|---|
| `twok` | El Camino de los Reyes | 75 | 16 | 16 | Numeric chapters |
| `wor` | Palabras radiantes | 89 | 0 | 0 | Numeric chapters |
| `ob` | Juramentada | 122 | 0 | 0 | Numeric chapters |
| `row` | El Ritmo de la Guerra | 117 | 0 | 0 | Numeric chapters |
| `sawt` | Viento y Verdad | 11 | 0 | 0 | Only the safe numeric prefix through chapter 11 is locator-backed; chapter numbers 12 and 14 are ambiguous |
| `edgedancer` | Danzante del Filo | 20 | 17 | 17 | Numeric chapters |
| `dawnshard` | Esquirla del amanecer | 19 | 17 | 17 | Numeric chapters |

## Interpretation rules

1. **Catalogue entry is not source access.** A bibliography record identifies a supplied work; it does not prove that any passage was read.
2. **Edition structure is not navigation coverage.** Chapter counts are derived from the recorded edition structure and exclude unmodelled front/back matter and special sections.
3. **Navigation locator is not body inspection.** A TOC href plus navigation digest proves only that the target is represented in the inspected navigation document.
4. **Body inspection is sparse and exact.** A chapter counts as inspected only when its exact XHTML bytes have an edition-bound locator and an allowlisted SHA-256 digest.
5. **Staging is not approval.** All 59 summaries remain `pending-review`. The 77-record editorial bundle being `ready-for-review` means its cross-references are structurally complete, not that any record has been approved.
6. **Production remains empty.** The knowledge registry, approved-claim registry and topic-assignment activation receipt remain empty/null.
7. **Ambiguity remains blocked.** Elantris, Viento y Verdad, Arena blanca and Arcanum ilimitado retain their conservative progress policies. This report does not infer missing locators or section boundaries.
8. **No cross-book unlock.** A verified chapter or cursor in one work never authorizes evidence from another work.

## Implementation

- `src/hoid/sourceCoverage.ts` builds the immutable report from the checked-in bibliography, edition policies, reading manifests, sparse navigation/document allowlists, staging drafts and production registry.
- `src/hoid/verifiedChapterDocuments.ts` exposes the sorted chapter numbers whose original XHTML bytes were individually inspected. It exposes no prose or hashes through the coverage report.
- `src/hoid/sourceCoverage.test.ts` asserts the 24-work inventory, 1,106 locators, 59 inspected documents, 59 pending summaries, ambiguous/segmented policies and empty production registries.
- `hoid-source-coverage-audit.yml` runs the coverage and source-boundary regressions with strict TypeScript checks.

## Scope of Run 165 (historical)

Run 165 materialized the three unique Roshar EPUBs currently present in the Library and inspected only these chapter-body targets:

- El Camino de los Reyes, chapters 9–10 — OEBPS/Text/L1-023.xhtml and OEBPS/Text/L1-024.xhtml;
- Danzante del Filo, chapters 10–11 — OEBPS/Text/010.xhtml and OEBPS/Text/011.xhtml;
- Esquirla del amanecer, chapters 10–11 — OEBPS/Text/10.xhtml and OEBPS/Text/11.xhtml.

For each source, the navigation-document digest matched the edition-bound value already recorded in the repository. Each target was confirmed in the EPUB OPF manifest and spine before its exact XHTML bytes were SHA-256 fingerprinted. Six original Spanish summaries were added to staging with the next-chapter unlock boundary. All remain pending review.

At the time of Run 165, the Library listing did not include cosmere.epub, so no new Cosmere chapter was inspected in that run. The existing Cosmere catalogue and navigation metadata remain structural records only.

No EPUB, XHTML body, copied passage, image, extracted text or private device URI is committed. The report contains work metadata, counts and chapter numbers only.


## Run 168 — Cosmere and Roshar chapter expansion

Four additional chapter bodies were inspected from the current Library copies. For every EPUB, the recorded navigation digest was rechecked; the target was resolved from the EPUB navigation document, matched to exactly one OPF manifest item, confirmed in the reading spine, and SHA-256 fingerprinted from the original XHTML bytes.

| Work | Chapter | Relative XHTML target | Document SHA-256 | Future unlock |
|---|---:|---|---|---:|
| El Imperio Final | 4 | EPUB/books/b000001/OEBPS/Text/004.xhtml | 6b729cfc609f926a4bac5b10f3eb5148a7c8935adde54f51f4ff13b9995b35d7 | 5 |
| El Camino de los Reyes | 11 | OEBPS/Text/L1-025.xhtml | 3198740aafd799096672d6a893b925c08a4f33819219e7769761319eaea97ae5 | 12 |
| Danzante del Filo | 12 | OEBPS/Text/012.xhtml | d02ecf9613cb9ae5ff8f95984b2a7bcdf56b19c72e9dcc6f193a1a959150155c | 13 |
| Esquirla del amanecer | 12 | OEBPS/Text/12.xhtml | d5d73c0ebaaaeccf2dfbd2f16315aa521b860c043c0b61b971bbce76b7bc8990 | 13 |

Four original Spanish summaries were added to staging. All remain pending review; no production registry, approved-claim registry or activation receipt was changed. The staging inventory now contains 39 summaries backed by 39 individually inspected chapter documents. The 24-work catalogue and 1,106 verified navigation locators are unchanged.

No EPUB bytes, XHTML bodies, copied passages, images, extracted prose or private file paths were committed.


## Run 170 — four additional chapter documents

The Library copies of `cosmere.epub` and the three Roshar EPUBs were re-opened for this batch. Each ZIP passed CRC validation. The recorded navigation-document SHA-256 was rechecked, and every target was resolved from navigation, matched to the OPF manifest and confirmed in the reading spine before the original XHTML bytes were fingerprinted.

| Work | Chapter | Relative XHTML target | Document SHA-256 | Completed-through watermark | Minimum open cursor |
|---|---:|---|---|---:|---:|
| El Imperio Final | 5 | EPUB/books/b000001/OEBPS/Text/005.xhtml | ec48d5ed29ede0760a63d913fcc71d79c908d879fe62841fe6cbfc64d90676d8 | 5 | 6 |
| El Camino de los Reyes | 12 | OEBPS/Text/L1-032.xhtml | 1f220d29b388c67834fb11d21fdb120407d1220531d735f946c00cc26223e838 | 12 | 13 |
| Danzante del Filo | 13 | OEBPS/Text/013.xhtml | 341ffa8144efe7c054d92bbedd54246889a92b268db7b62118f6b651095a516d | 13 | 14 |
| Esquirla del amanecer | 13 | OEBPS/Text/13.xhtml | e0a97fb4d28b90b99169e6afcdf4fbd3e42b67c1ff5b0c61e0cb4aad6405544c | 13 | 14 |

The four navigation digests remain the registered edition values: Cosmere `85c53b4a…`, Roshar omnibus `08280d2a…`, Edgedancer `5b98fb80…` and Dawnshard `8ae9931d…`. All four targets matched their exact edition navigation entries, manifest items and spine entries.

Four original Spanish summaries were added to staging with summary digests and exact edition-bound provenance. All remain pending review. The current inventory is 43 inspected chapter documents and 43 staged summaries across the same four works. Production knowledge remains empty; no approved claim or activation receipt was added.

The evidence watermark is the completed-through chapter N. The open reader cursor must reach N+1. The cursor/evidence integration regression tests this boundary for all four new drafts and confirms that progress in another book cannot unlock them.

No EPUB bytes, XHTML bodies, copied passages, extracted prose, images or private file paths were committed.


## Run 174 — three additional Roshar chapter documents

The latest Library copies of the Roshar omnibus, Danzante del Filo and Esquirla del amanecer were inspected. Each ZIP passed CRC validation; each registered navigation digest matched; every chapter target was confirmed in the OPF manifest and spine before its XHTML bytes were fingerprinted.

The new documents are El Camino de los Reyes chapter 13 (`L1-033.xhtml`), Danzante del Filo chapter 14 (`Text/014.xhtml`) and Esquirla del amanecer chapter 14 (`Text/14.xhtml`). Their exact edition and document digests, unlock watermarks and source checks are recorded in [RUN174_ROSHAR_CHAPTER_EXPANSION.md](RUN174_ROSHAR_CHAPTER_EXPANSION.md).

Three original Spanish summaries were added to staging. The current inventory is 46 inspected chapter documents and 46 pending summaries. Production knowledge remains empty, with zero approved claims and no activation receipt. No EPUB, XHTML body, copied passage, extracted prose, image or private file path was committed.


## Run 175 — cuatro nuevos documentos de capítulo

Se reabrieron los cuatro EPUB privados y se comprobó que sus huellas de navegación coincidían con las ediciones registradas. Cada XHTML nuevo se resolvió desde la navegación, se encontró en el manifiesto OPF y en el reading spine, y se fingerprintó desde los bytes originales.

| Obra | Capítulo | Destino XHTML relativo | SHA-256 del documento |
|---|---:|---|---|
| El Imperio Final | 6 | `books/b000001/OEBPS/Text/006.xhtml` | `8b8596f106ac9f0510624c86849750358a934ab064036f91a70189378deda299` |
| El Camino de los Reyes | 14 | `L1-034.xhtml` | `6b5e5693ebbf7825cdbf9b0be1538641e8e412bfe8aba322453a80ec113d5e4e` |
| Danzante del Filo | 15 | `Text/015.xhtml` | `0cf7efadeb8eae0c6c3563cb0bd5e7beef853bb1d75dfa69ba6734af7c7aa786` |
| Esquirla del amanecer | 15 | `Text/15.xhtml` | `8ddd62ba14191c2a333e6da18beabc5205f50b6aa45472cfd16e25e6ba573dd5` |

Cuatro resúmenes originales en español se añadieron a staging con SHA-256 propio, localizador exacto y watermark de capítulo completado N. El cursor mínimo de lectura es N+1. Los cuatro permanecen pendientes de revisión independiente.

El inventario actualizado es de **50 documentos de capítulo inspeccionados y 50 resúmenes originales pendientes de revisión**, en cuatro obras. El catálogo sigue conteniendo 24 obras y 1.106 localizadores de navegación verificados. No se ha aprobado ninguna afirmación, no hay conocimiento en producción ni recibo de activación.

No se han subido EPUBs, XHTML, texto extraído, pasajes, imágenes ni rutas privadas.


## Run 176 — tres nuevos documentos de Roshar

Se inspeccionaron tres capítulos nuevos desde las copias actuales de la biblioteca privada. Los contenedores ZIP superaron CRC; las huellas de navegación coincidieron con las ediciones registradas; cada destino se resolvió desde la navegación, se confirmó en el manifiesto OPF y en el reading spine, y se fingerprintó desde los bytes XHTML originales.

| Obra | Capítulo | XHTML relativo | SHA-256 del documento |
|---|---:|---|---|
| El Camino de los Reyes | 15 | `L1-035.xhtml` | `43ff1d4f608fb3ec230923d92edadd09bc3c9606d72d506b547c7be43266f492` |
| Danzante del Filo | 16 | `Text/016.xhtml` | `d3a247b59d08735b83baa9840ef9e5058cc3f2108c931d66f06d370c4d41a4dd` |
| Esquirla del amanecer | 16 | `Text/16.xhtml` | `d62fefc1ce3e6eab0a0cfa5fa8e08819d5d5a9d3a2b2d12015ffaa9411cd18a2` |

Se añadieron tres resúmenes originales en español, todos pendientes de revisión. El inventario asciende a **53 documentos de capítulo y 53 resúmenes pendientes**, en cuatro obras. El catálogo conserva 24 obras y 1.106 localizadores. La producción sigue vacía, con cero afirmaciones aprobadas y sin recibo de activación.

La búsqueda actual en Library y archivos de conversación no encontró `cosmere.epub`; por ello El Imperio Final capítulo 7 no se inspeccionó y permanece como candidato de metadatos. No se subieron EPUBs, XHTML, pasajes, imágenes ni rutas privadas.


## Run 178 — El Imperio Final chapter seven

The current Library copy of `cosmere.epub` was re-opened for the next planned TFE chapter. The full ZIP container passed CRC validation. The EPUB 3 navigation document SHA-256 matched the registered Cosmere edition digest (`85c53b4a…`). The Chapter 7 navigation target resolved to exactly one OPF manifest item and was present in the reading spine. The exact XHTML bytes were fingerprinted as `fd79119ff64538b1d9fbe0d5d40ff9db8215afd144a27071c7c35b19b5ed1ac3`.

One original Spanish summary was added to staging with its exact edition-bound locator and source digest. Its completed-through evidence watermark is chapter 7; the minimum open reader cursor is chapter 8. It remains `pending-review` and is not part of production knowledge.

The current inventory at the end of Run 178 was **54 individually inspected chapter documents and 54 original summaries pending review**, across the same four works. The catalogue remained at 24 works and 1,106 verified navigation locators. Approved claims and production knowledge remained at zero; the activation receipt remained null. No EPUB bytes, XHTML bodies, copied passages, images or private file paths were committed.


## Run 181 — El Imperio Final chapter eight

The current Library copy of `cosmere.epub` was materialized locally for a one-chapter inspection. The complete ZIP passed CRC validation. The EPUB navigation SHA-256 matched the registered edition digest. The Chapter 8 target resolved to one OPF manifest item, was present in the reading spine, and followed the already registered Chapter 7 XHTML digest. The exact Chapter 8 XHTML digest is `5dc769cfdd8dfbfa91292ec9421b0ede94c8e1b05fd3560f9d9503b058e43d48`.

One original Spanish summary was added to editorial staging. Its evidence source and completed-through watermark are Chapter 8; the first cursor eligible to unlock it is Chapter 9. It remains `pending-review` and is not production knowledge.

The current inventory is **55 individually inspected chapter documents and 55 original summaries pending review**, across four works. The catalogue remains at 24 works and 1,106 verified navigation locators. Approved claims and production knowledge remain at zero; the activation receipt remains null. The EPUB was not committed; no XHTML body or copied passage was uploaded.

## Run 191 — three additional Roshar chapter documents

The current private Library copies of the Roshar omnibus, Danzante del Filo and Esquirla del amanecer were re-opened. Each ZIP passed CRC validation. The registered navigation SHA-256 remained unchanged for each edition. The immediately preceding inspected chapter digest also matched the existing allowlist, preserving edition continuity.

Each new chapter target was resolved from the EPUB NCX navigation, matched to exactly one OPF manifest item and confirmed in the reading spine before the exact XHTML bytes were fingerprinted.

| Work | Chapter | Relative XHTML target | Document SHA-256 | Summary SHA-256 | Minimum reader cursor |
|---|---:|---|---|---|---:|
| El Camino de los Reyes | 16 | `OEBPS/Text/L1-037.xhtml` | `1f9d38db4cde7a471586ff7ed5d88cbef7a72b3616020ca1c4d8f06093e7da32` | `0144eabf67c561f71884fb03a523cbf5d8f42f8458dc72fe3aded5bb64d99076` | 17 |
| Danzante del Filo | 17 | `OEBPS/Text/017.xhtml` | `250c26f671df7422277711bbefd1f72a381a5dd1791bb28d9efb50e7e8c1352c` | `03d9f250332a63ef25c0a8a592b1d1d3d0a08ab3fd511e4db138ba4b13b29576` | 18 |
| Esquirla del amanecer | 17 | `OEBPS/Text/17.xhtml` | `85fe1ee6a0224ef0ebc04c8f3e327e30a6553f2623a7482be66d5a4e1b2af840` | `c341e1d3a83e251680ad04e2b80cdc95d5ade8cff1e1faf58dec3bd9520c3495` | 18 |

The three original Spanish summaries were added to editorial staging only. All remain `pending-review`; no production knowledge, approved claim or activation receipt was changed. The completed-through watermark is chapter N and the first eligible open cursor is N+1.

The current inventory is **58 individually inspected chapter documents and 58 original summaries pending review**, across the same four works. The catalogue remains at 24 works and 1,106 verified navigation locators. Production knowledge and approved claims remain empty.

No EPUB, XHTML body, copied passage, extracted prose, image or private device path was committed.



## Run 192 — El Imperio Final, capítulo 9

The current Library copy of `cosmere.epub` was explicitly selected for a candidate-only inspection. The complete ZIP passed CRC validation. Its navigation-document SHA-256 matched the registered `cosmere-epub-merged-v1` edition digest. The previously registered chapter-eight XHTML digest also matched, confirming continuity with the inspected prefix.

The chapter-nine navigation target `books/b000001/OEBPS/Text/009.xhtml` was resolved from the EPUB navigation document, matched exactly one OPF manifest item, and was confirmed in the reading spine. The original XHTML bytes produced document SHA-256 `e08f8b2845eb2d15ed9a1ad517d2207501ba0068f25797643e127919d92daedb`.

One original Spanish summary was staged with summary SHA-256 `a53963d7734af570e745e6a569ed1eeafa374eab234f7eac1bacd94d1020a5be`, exact edition-bound provenance and a completed-through evidence watermark of chapter 9. Its first eligible open reader cursor is chapter 10. It remains `pending-review`; no approved claim, activation receipt or production knowledge was added. No EPUB bytes, XHTML body, copied passage, extracted source text, image or private file path was committed.

The current inventory is **59 individually inspected chapter documents and 59 original summaries pending review**, across the same four works. The catalogue remains at 24 works and 1,106 verified navigation locators. The next TFE candidate is chapter 10; the Roshar continuation candidates remain chapters 17, 18 and 18.
